import { describe, it, expect, vi, beforeEach } from "vitest"
import { generate, generateFull, listModels, testConnection } from "@/lib/ai/ollama"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function mockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })

  return {
    ok: true,
    body: stream,
  } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("generate", () => {
  it("yields content tokens from streamed response", async () => {
    const lines = [
      JSON.stringify({ done: false, message: { role: "assistant", content: "Hello" } }),
      "\n",
      JSON.stringify({ done: false, message: { role: "assistant", content: " world" } }),
      "\n",
      JSON.stringify({ done: true, message: { role: "assistant", content: "" } }),
      "\n",
    ]

    mockFetch.mockResolvedValueOnce(mockStreamResponse(lines))

    const tokens: string[] = []
    for await (const token of generate("http://localhost:11434", "llama3", [
      { role: "user", content: "hi" },
    ])) {
      tokens.push(token)
    }

    expect(tokens).toEqual(["Hello", " world"])
  })

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal server error",
      body: null,
    } as unknown as Response)

    const gen = generate("http://localhost:11434", "llama3", [
      { role: "user", content: "hi" },
    ])

    await expect(gen[Symbol.asyncIterator]().next()).rejects.toThrow(
      "Ollama request failed 500",
    )
  })
})

describe("generateFull", () => {
  it("returns full content from non-streaming response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        done: true,
        message: { role: "assistant", content: "Full response text" },
      }),
    } as unknown as Response)

    const result = await generateFull("http://localhost:11434", "llama3", [
      { role: "user", content: "hi" },
    ])

    expect(result.content).toBe("Full response text")
    expect(result.toolCalls).toEqual([])
  })

  it("returns tool calls when present", async () => {
    const toolCall = {
      function: { name: "lookup", arguments: { ip: "1.2.3.4" } },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        done: true,
        message: { role: "assistant", content: "", tool_calls: [toolCall] },
      }),
    } as unknown as Response)

    const result = await generateFull("http://localhost:11434", "llama3", [])
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].function.name).toBe("lookup")
  })
})

describe("listModels", () => {
  it("returns model names from /api/tags", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: "llama3" }, { name: "mistral" }] }),
    } as unknown as Response)

    const models = await listModels("http://localhost:11434")
    expect(models).toEqual(["llama3", "mistral"])
  })

  it("throws on connection failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"))
    await expect(listModels("http://localhost:11434")).rejects.toThrow()
  })

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service unavailable",
    } as unknown as Response)

    await expect(listModels("http://localhost:11434")).rejects.toThrow(
      "Ollama tags request failed 503",
    )
  })
})

describe("testConnection", () => {
  it("resolves when Ollama is reachable", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    } as unknown as Response)

    await expect(testConnection("http://localhost:11434")).resolves.toBeUndefined()
  })
})
