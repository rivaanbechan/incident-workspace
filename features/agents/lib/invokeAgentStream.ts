import { getAgentById } from "@/lib/db/agents"
import { getStoredDatasourceById } from "@/lib/db/datasources"
import { toLLMDatasource } from "@/lib/datasources/ollama"
import { acquire, release } from "@/lib/ai/concurrency"
import { generate, generateFull } from "@/lib/ai/ollama"
import { getToolsForAgent } from "@/features/agents/lib/toolRegistry"
import { buildSystemPrompt } from "@/features/agents/lib/agentPrompts"
import { serialiseBoardForScope } from "@/features/agents/lib/boardContext"
import type { BoardEntity, BoardConnection } from "@/features/incident-workspace/lib/board/types"
import type { OllamaMessage, OllamaTool } from "@/lib/ai/ollama"
import { NextResponse } from "next/server"

export type InvokeRequestBody = {
  focusEntity: BoardEntity
  entities?: BoardEntity[]
  connections?: BoardConnection[]
}

function buildToolsArray(
  tools: Awaited<ReturnType<typeof getToolsForAgent>>,
): OllamaTool[] {
  return tools.map((tool) => ({
    function: {
      description: tool.description,
      name: tool.id,
      parameters: {
        properties: {
          entityKind: { description: "The kind of entity to enrich", type: "string" },
          entityValue: { description: "The value of the entity (e.g. IP address, domain, hash)", type: "string" },
        },
        required: ["entityKind", "entityValue"],
        type: "object",
      },
    },
    type: "function",
  }))
}

export async function invokeAgentStream(
  agentId: string,
  body: InvokeRequestBody,
): Promise<Response> {
  const agent = await getAgentById(agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 })
  }

  const llmDatasourceRecord = await getStoredDatasourceById(agent.llmDatasourceId)

  if (!llmDatasourceRecord) {
    return NextResponse.json(
      { error: "LLM datasource not found or not configured." },
      { status: 422 },
    )
  }

  const llmDatasource = toLLMDatasource(llmDatasourceRecord)
  const acquired = acquire(agent.llmDatasourceId, llmDatasource.maxConcurrent)

  if (!acquired) {
    return NextResponse.json(
      { error: "model is at capacity — try again shortly" },
      { status: 409 },
    )
  }

  const entities = Array.isArray(body.entities) ? body.entities : [body.focusEntity]
  const connections = Array.isArray(body.connections) ? body.connections : []
  const boardContext = serialiseBoardForScope(body.focusEntity.id, entities, connections)
  const tools = await getToolsForAgent(agentId)
  const systemPrompt = buildSystemPrompt(agent, tools, boardContext)

  const baseUrl = llmDatasource.baseUrl
  const modelId = llmDatasource.defaultModel
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: string) => {
        // JSON-encode the data so newlines and other control characters survive SSE framing
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const messages: OllamaMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyse this entity:\n\n${boardContext}` },
        ]

        if (llmDatasource.supportsToolCalling && tools.length > 0) {
          const ollamaTools = buildToolsArray(tools)
          let continueLoop = true

          while (continueLoop) {
            const response = await generateFull(baseUrl, modelId, messages, { tools: ollamaTools })

            if (response.toolCalls.length > 0) {
              messages.push({ role: "assistant", content: response.content })

              for (const call of response.toolCalls) {
                const tool = tools.find((t) => t.id === call.function.name)
                enqueue("tool_call", JSON.stringify({ name: call.function.name }))

                if (tool) {
                  const kind = call.function.arguments.entityKind as never
                  const value = call.function.arguments.entityValue as string

                  try {
                    const result = await tool.execute(kind, value)
                    messages.push({ role: "tool", content: JSON.stringify(result) })
                    enqueue("tool_result", JSON.stringify({ name: call.function.name, verdict: result.verdict }))
                  } catch (toolError) {
                    messages.push({
                      role: "tool",
                      content: `Error: ${toolError instanceof Error ? toolError.message : "Tool failed"}`,
                    })
                  }
                }
              }
            } else {
              for await (const token of generate(baseUrl, modelId, messages)) {
                enqueue("token", token)
              }
              continueLoop = false
            }
          }
        } else {
          for await (const token of generate(baseUrl, modelId, messages)) {
            enqueue("token", token)
          }
        }

        enqueue("done", "complete")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invocation failed"
        enqueue("error", message)
      } finally {
        release(agent.llmDatasourceId)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    },
  })
}
