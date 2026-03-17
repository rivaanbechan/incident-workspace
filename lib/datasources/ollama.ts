import { listModels, testConnection as pingOllama } from "@/lib/ai/ollama"
import type {
  DatasourceAdapter,
  DatasourceConfigPayload,
  DatasourceConnectionStatus,
  LLMDatasource,
  StoredDatasourceInstallation,
} from "@/lib/datasources/types"

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

function resolveConfig(config: DatasourceConfigPayload): LLMDatasource["defaultModel"] extends string
  ? { defaultModel: string; maxConcurrent: number; supportsToolCalling: boolean }
  : never {
  return {
    defaultModel: typeof config.defaultModel === "string" ? config.defaultModel.trim() : "",
    maxConcurrent:
      typeof config.maxConcurrent === "number" && config.maxConcurrent > 0
        ? Math.floor(config.maxConcurrent)
        : 1,
    supportsToolCalling: config.supportsToolCalling === true,
  } as never
}

export function toLLMDatasource(datasource: StoredDatasourceInstallation): LLMDatasource {
  const config = resolveConfig(datasource.config)

  return {
    baseUrl: datasource.baseUrl,
    category: "llm",
    createdAt: datasource.createdAt,
    defaultModel: config.defaultModel,
    enabled: datasource.enabled,
    id: datasource.id,
    maxConcurrent: config.maxConcurrent,
    supportsToolCalling: config.supportsToolCalling,
    title: datasource.title,
    updatedAt: datasource.updatedAt,
    vendor: datasource.vendor,
  }
}

async function testOllamaConnection(
  datasource: StoredDatasourceInstallation,
): Promise<DatasourceConnectionStatus> {
  const baseUrl = normalizeBaseUrl(datasource.baseUrl)
  const checkedAt = new Date().toISOString()

  await pingOllama(baseUrl)
  const models = await listModels(baseUrl)

  const modelList = models.slice(0, 6).join(", ")
  const suffix = models.length > 6 ? ` (+${models.length - 6} more)` : ""

  return {
    checkedAt,
    message: models.length > 0
      ? `Connected. Available models: ${modelList}${suffix}.`
      : "Connected. No models found — pull a model with `ollama pull <model>`.",
    ok: true,
  }
}

function validateOllamaConfig(
  config: DatasourceConfigPayload,
  options?: { existingConfig?: DatasourceConfigPayload | null },
): DatasourceConfigPayload {
  const defaultModel =
    (typeof config.defaultModel === "string" ? config.defaultModel.trim() : "") ||
    (typeof options?.existingConfig?.defaultModel === "string"
      ? options.existingConfig.defaultModel.trim()
      : "")

  if (!defaultModel) {
    throw new Error("A default model name is required (e.g. llama3, mistral).")
  }

  const maxConcurrent =
    typeof config.maxConcurrent === "number"
      ? Math.floor(config.maxConcurrent)
      : typeof options?.existingConfig?.maxConcurrent === "number"
        ? Math.floor(options.existingConfig.maxConcurrent)
        : 1

  if (maxConcurrent < 1) {
    throw new Error("maxConcurrent must be at least 1.")
  }

  return {
    defaultModel,
    maxConcurrent,
    supportsToolCalling: config.supportsToolCalling === true,
  }
}

export const ollamaAdapter: DatasourceAdapter = {
  definition: {
    capabilities: {
      supportsHealthcheck: true,
      supportsSearch: false,
    },
    category: "llm",
    description:
      "Local Ollama LLM server for AI analyst invocations. Incident data stays in your environment.",
    id: "ollama",
    title: "Ollama",
    vendor: "ollama",
  },
  testConnection: testOllamaConnection,
  validateConfig: validateOllamaConfig,
}
