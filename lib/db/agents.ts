import { createSchemaGuard, dbQuery, generateId, getDbPool } from "@/lib/db/index"
import type { Agent } from "@/lib/contracts/agents"

type AgentRow = {
  created_at: string
  id: string
  llm_datasource_id: string
  name: string
  org_id: string
  persona_prompt: string
  tools: string[]
  updated_at: string
}

const ensureAgentSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      persona_prompt TEXT NOT NULL,
      tools JSONB NOT NULL DEFAULT '[]',
      llm_datasource_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Drop legacy model_id column if it exists from older schema versions
  await dbQuery(`ALTER TABLE agents DROP COLUMN IF EXISTS model_id`)
})

function mapAgent(row: AgentRow): Agent {
  return {
    createdAt: row.created_at,
    id: row.id,
    llmDatasourceId: row.llm_datasource_id,
    name: row.name,
    orgId: row.org_id,
    personaPrompt: row.persona_prompt,
    tools: Array.isArray(row.tools) ? row.tools : [],
    updatedAt: row.updated_at,
  }
}

const SELECT_FIELDS = `
  id,
  org_id,
  name,
  persona_prompt,
  tools,
  llm_datasource_id,
  created_at::text,
  updated_at::text
`

export async function listAgentsByOrg(orgId: string): Promise<Agent[]> {
  if (!getDbPool()) {
    return []
  }

  await ensureAgentSchema()

  const result = await dbQuery<AgentRow>(
    `SELECT ${SELECT_FIELDS} FROM agents WHERE org_id = $1 ORDER BY name ASC`,
    [orgId],
  )

  return result.rows.map(mapAgent)
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  if (!getDbPool()) {
    return null
  }

  await ensureAgentSchema()

  const result = await dbQuery<AgentRow>(
    `SELECT ${SELECT_FIELDS} FROM agents WHERE id = $1`,
    [agentId],
  )

  const row = result.rows[0]
  return row ? mapAgent(row) : null
}

export type CreateAgentInput = {
  llmDatasourceId: string
  name: string
  orgId: string
  personaPrompt: string
  tools: string[]
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAgentSchema()

  const id = generateId("agent")

  const result = await dbQuery<AgentRow>(
    `
      INSERT INTO agents (id, org_id, name, persona_prompt, tools, llm_datasource_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
      RETURNING ${SELECT_FIELDS}
    `,
    [
      id,
      input.orgId,
      input.name.trim(),
      input.personaPrompt,
      JSON.stringify(input.tools),
      input.llmDatasourceId,
    ],
  )

  return mapAgent(result.rows[0])
}

export type UpdateAgentInput = Partial<Omit<CreateAgentInput, "orgId">>

export async function updateAgent(agentId: string, input: UpdateAgentInput): Promise<Agent | null> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAgentSchema()

  const fields: string[] = []
  const values: unknown[] = []
  let i = 1

  if (input.name !== undefined) {
    fields.push(`name = $${i++}`)
    values.push(input.name.trim())
  }

  if (input.personaPrompt !== undefined) {
    fields.push(`persona_prompt = $${i++}`)
    values.push(input.personaPrompt)
  }

  if (input.tools !== undefined) {
    fields.push(`tools = $${i++}::jsonb`)
    values.push(JSON.stringify(input.tools))
  }

  if (input.llmDatasourceId !== undefined) {
    fields.push(`llm_datasource_id = $${i++}`)
    values.push(input.llmDatasourceId)
  }

  if (fields.length === 0) {
    return getAgentById(agentId)
  }

  fields.push(`updated_at = NOW()`)
  values.push(agentId)

  const result = await dbQuery<AgentRow>(
    `UPDATE agents SET ${fields.join(", ")} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
    values,
  )

  const row = result.rows[0]
  return row ? mapAgent(row) : null
}

export async function deleteAgent(agentId: string): Promise<string | null> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAgentSchema()

  const result = await dbQuery<{ id: string }>(
    `DELETE FROM agents WHERE id = $1 RETURNING id`,
    [agentId],
  )

  return result.rows[0]?.id ?? null
}
