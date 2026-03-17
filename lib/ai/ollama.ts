/**
 * Raw Ollama HTTP client. Pure infrastructure — no agent logic here.
 */

export type OllamaMessage = {
  content: string
  role: "assistant" | "system" | "tool" | "user"
}

export type OllamaTool = {
  function: {
    description: string
    name: string
    parameters: {
      properties: Record<string, { description?: string; type: string }>
      required?: string[]
      type: "object"
    }
  }
  type: "function"
}

export type OllamaToolCall = {
  function: {
    arguments: Record<string, unknown>
    name: string
  }
}

type OllamaChatResponse = {
  done: boolean
  message: {
    content: string
    role: string
    tool_calls?: OllamaToolCall[]
  }
}

type OllamaTagsResponse = {
  models: Array<{ name: string }>
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

export async function* generate(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  options?: {
    signal?: AbortSignal
    tools?: OllamaTool[]
  },
): AsyncIterable<string> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/chat`

  const response = await fetch(url, {
    body: JSON.stringify({
      messages,
      model,
      stream: true,
      tools: options?.tools,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: options?.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama request failed ${response.status}: ${text.slice(0, 280)}`)
  }

  if (!response.body) {
    throw new Error("Ollama returned no response body.")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })

      for (const line of chunk.split("\n")) {
        const trimmed = line.trim()

        if (!trimmed) {
          continue
        }

        try {
          const parsed = JSON.parse(trimmed) as OllamaChatResponse

          if (parsed.message?.content) {
            yield parsed.message.content
          }
        } catch {
          // Partial JSON line — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function generateFull(
  baseUrl: string,
  model: string,
  messages: OllamaMessage[],
  options?: {
    signal?: AbortSignal
    tools?: OllamaTool[]
  },
): Promise<{ content: string; toolCalls: OllamaToolCall[] }> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/chat`

  const response = await fetch(url, {
    body: JSON.stringify({
      messages,
      model,
      stream: false,
      tools: options?.tools,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal: options?.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama request failed ${response.status}: ${text.slice(0, 280)}`)
  }

  const parsed = (await response.json()) as OllamaChatResponse
  return {
    content: parsed.message?.content ?? "",
    toolCalls: parsed.message?.tool_calls ?? [],
  }
}

export async function listModels(baseUrl: string): Promise<string[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/tags`

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    method: "GET",
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Ollama tags request failed ${response.status}: ${text.slice(0, 280)}`)
  }

  const parsed = (await response.json()) as OllamaTagsResponse
  return parsed.models?.map((m) => m.name) ?? []
}

export async function testConnection(baseUrl: string): Promise<void> {
  await listModels(baseUrl)
}
