"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiRequest } from "@/lib/api/client"
import type { Agent } from "@/lib/contracts/agents"
import type { BoardEntity } from "@/features/incident-workspace/lib/board/types"

/**
 * Board entity types that agents can meaningfully enrich.
 * Zones and screen tiles are excluded — they are structural, not IOC carriers.
 */
const ENRICHABLE_BOARD_TYPES = ["note", "incidentCard", "statusMarker"] as const

function isEnrichableEntity(entity: BoardEntity): boolean {
  return (ENRICHABLE_BOARD_TYPES as readonly string[]).includes(entity.type)
}

function getLastUsedAgentId(orgId: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`lastAgentId:${orgId}`) ?? null
}

function setLastUsedAgentId(orgId: string, agentId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`lastAgentId:${orgId}`, agentId)
  }
}

type Props = {
  caseId: string
  focusEntity: BoardEntity
  isAgentRunning: boolean
  onInvoke: (agentId: string, focusEntity: BoardEntity, agentName: string) => void
  orgId: string
}

export function AskAgentButton({
  caseId,
  focusEntity,
  isAgentRunning,
  onInvoke,
  orgId,
}: Props) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [lastAgentId, setLastAgentIdState] = useState<string | null>(null)

  useEffect(() => {
    setLastAgentIdState(getLastUsedAgentId(orgId))
  }, [orgId])

  useEffect(() => {
    void apiRequest<{ agents: Agent[] }>("/api/agents")
      .then((payload) => setAgents(payload.agents))
      .catch(() => setAgents([]))
  }, [])

  // Only show for entity types that agents can meaningfully enrich
  const supportedAgents = isEnrichableEntity(focusEntity) ? agents : []

  const lastAgent = supportedAgents.find((a) => a.id === lastAgentId) ?? supportedAgents[0]

  const handleInvoke = useCallback(
    (agent: Agent) => {
      setLastUsedAgentId(orgId, agent.id)
      setLastAgentIdState(agent.id)
      onInvoke(agent.id, focusEntity, agent.name)
    },
    [focusEntity, onInvoke, orgId],
  )

  if (supportedAgents.length === 0) {
    return null
  }

  if (isAgentRunning) {
    return (
      <Button disabled size="sm" type="button" variant="secondary">
        Agent running…
      </Button>
    )
  }

  if (supportedAgents.length === 1) {
    return (
      <Button
        onClick={() => handleInvoke(lastAgent)}
        size="sm"
        type="button"
        variant="secondary"
      >
        Ask {lastAgent.name}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" type="button" variant="secondary">
          {lastAgent.name} ▾
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {supportedAgents.map((agent) => (
          <DropdownMenuItem key={agent.id} onClick={() => handleInvoke(agent)}>
            {agent.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
