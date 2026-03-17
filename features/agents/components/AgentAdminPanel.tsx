"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/shell/FormField"
import { SelectableCard } from "@/features/integrations/components/SelectableCard"
import type { Agent } from "@/lib/contracts/agents"
import type { DatasourceInstallation } from "@/lib/datasources/types"
import { AgentToolSelector } from "@/features/agents/components/AgentToolSelector"

const DEFAULT_PERSONA = `You are an L1 security analyst. Your job is to enrich the provided indicator of compromise using the available tools and deliver a clear verdict with your reasoning.
Call each relevant tool, then summarise what you found. Be concise and direct.
State your confidence level (high / medium / low) and your verdict (malicious / benign / unknown).`

type AgentForm = {
  llmDatasourceId: string
  name: string
  personaPrompt: string
  tools: string[]
}

function emptyForm(): AgentForm {
  return {
    llmDatasourceId: "",
    name: "",
    personaPrompt: DEFAULT_PERSONA,
    tools: [],
  }
}

type ListPayload = {
  agents: Agent[]
}

type DatasourceListPayload = {
  datasources: DatasourceInstallation[]
}

export function AgentAdminPanel() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [llmDatasources, setLlmDatasources] = useState<DatasourceInstallation[]>([])
  const [enrichmentDatasources, setEnrichmentDatasources] = useState<DatasourceInstallation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<AgentForm>(emptyForm)
  const [status, setStatus] = useState("Select an agent to edit, or create a new one.")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [agentPayload, dsPayload] = await Promise.all([
        apiRequest<ListPayload>("/api/agents"),
        apiRequest<DatasourceListPayload>("/api/datasources"),
      ])
      setAgents(agentPayload.agents)
      setLlmDatasources(
        dsPayload.datasources.filter((d) => d.vendor === "ollama" && d.enabled),
      )
      setEnrichmentDatasources(
        dsPayload.datasources.filter(
          (d) => (d.vendor === "virustotal" || d.vendor === "virustotal-mock") && d.enabled,
        ),
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load agents.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (selectedAgent) {
      setForm({
        llmDatasourceId: selectedAgent.llmDatasourceId,
        name: selectedAgent.name,
        personaPrompt: selectedAgent.personaPrompt,
        tools: selectedAgent.tools,
      })
      setStatus(`Editing agent "${selectedAgent.name}".`)
    } else {
      setForm(emptyForm)
      setStatus("Create a new agent.")
    }
  }, [selectedAgent])

  const update = <K extends keyof AgentForm>(key: K, value: AgentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setStatus("Saving agent...")

      if (selectedAgent) {
        await apiRequest<{ agent: Agent }>(`/api/agents/${selectedAgent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        setStatus(`Saved agent "${form.name}".`)
      } else {
        const payload = await apiRequest<{ agent: Agent }>("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        setSelectedId(payload.agent.id)
        setStatus(`Created agent "${payload.agent.name}".`)
      }

      await loadData()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save agent.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedAgent) {
      return
    }

    const confirmed = window.confirm(`Delete agent "${selectedAgent.name}"?`)

    if (!confirmed) {
      return
    }

    try {
      setIsDeleting(true)
      setStatus(`Deleting agent "${selectedAgent.name}"...`)
      await apiRequest(`/api/agents/${selectedAgent.id}`, { method: "DELETE" })
      setSelectedId(null)
      setStatus("Agent deleted.")
      await loadData()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to delete agent.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Agents</CardTitle>
            <CardDescription>Select an agent to edit it.</CardDescription>
          </div>
          <Button onClick={() => setSelectedId(null)} size="sm" type="button">
            New Agent
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading agents...</div>
          ) : null}

          {!isLoading && agents.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              No agents configured yet.
            </div>
          ) : null}

          {agents.map((agent) => (
            <SelectableCard
              key={agent.id}
              isSelected={selectedId === agent.id}
              onClick={() => setSelectedId(agent.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-foreground">{agent.name}</div>
                <Badge variant="secondary">{agent.tools.length} tools</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {llmDatasources.find((d) => d.id === agent.llmDatasourceId)?.title ?? "No LLM configured"}
              </div>
            </SelectableCard>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{selectedAgent ? "Edit Agent" : "Create Agent"}</CardTitle>
            <CardDescription>{status}</CardDescription>
          </div>
          {selectedAgent ? (
            <Button
              disabled={isDeleting}
              onClick={handleDelete}
              size="sm"
              type="button"
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 rounded-3xl bg-muted/30 p-5">
            <FormField htmlFor="agent-name" label="Agent name">
              <Input
                id="agent-name"
                onChange={(e) => update("name", e.target.value)}
                placeholder="L1 Enrichment Analyst"
                value={form.name}
              />
            </FormField>

            <FormField htmlFor="agent-llm" label="LLM datasource">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                id="agent-llm"
                onChange={(e) => update("llmDatasourceId", e.target.value)}
                value={form.llmDatasourceId}
              >
                <option value="">— select Ollama instance —</option>
                {llmDatasources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.title}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField htmlFor="agent-persona" label="Persona prompt">
              <Textarea
                className="min-h-[120px] font-mono text-xs"
                id="agent-persona"
                onChange={(e) => update("personaPrompt", e.target.value)}
                value={form.personaPrompt}
              />
            </FormField>

            <AgentToolSelector
              enrichmentDatasources={enrichmentDatasources}
              selectedToolIds={form.tools}
              onChange={(tools) => update("tools", tools)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={isSaving} onClick={handleSave} type="button">
              {isSaving ? "Saving..." : selectedAgent ? "Save Changes" : "Create Agent"}
            </Button>
            {selectedAgent ? (
              <Button onClick={() => setSelectedId(null)} type="button" variant="outline">
                New Agent
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
