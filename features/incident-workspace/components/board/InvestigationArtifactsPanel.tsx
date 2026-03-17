"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { useToast } from "@/components/shell/ToastProvider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PersistedInvestigationArtifact } from "@/lib/contracts/artifacts"
import {
  buildArtifactCasePromotionInput,
  createCaseRecordViaApi,
} from "@/features/incident-workspace/lib/caseRecordPromotion"
import { EmptyState } from "@/components/shell/EmptyState"
import { formatTimestamp } from "@/lib/ui/formatters"

type InvestigationArtifactsPanelProps = {
  linkedCaseId?: string | null
  onCreateActionFromArtifact?: (artifact: PersistedInvestigationArtifact) => void
  roomId: string
}

export function InvestigationArtifactsPanel({
  linkedCaseId,
  onCreateActionFromArtifact,
  roomId,
}: InvestigationArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<PersistedInvestigationArtifact[]>([])
  const [status, setStatus] = useState("Loading shared investigation artifacts...")
  const [promotingArtifactId, setPromotingArtifactId] = useState<string | null>(null)
  const { showToast } = useToast()

  useEffect(() => {
    let isMounted = true

    const loadArtifacts = async () => {
      try {
        const response = await fetch(`/api/rooms/${roomId}/artifacts`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Unable to load room artifacts.")
        }

        const nextArtifacts = (await response.json()) as PersistedInvestigationArtifact[]

        if (!isMounted) {
          return
        }

        setArtifacts(nextArtifacts)
        setStatus(
          nextArtifacts.length > 0
            ? "Shared findings promoted into this incident room."
            : "No promoted findings yet. Send one from the hunt graph.",
        )
      } catch (error) {
        if (!isMounted) {
          return
        }

        setStatus(error instanceof Error ? error.message : "Unable to load artifacts.")
      }
    }

    void loadArtifacts()
    const intervalId = window.setInterval(loadArtifacts, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [roomId])

  const handlePromoteToCase = async (artifact: PersistedInvestigationArtifact) => {
    if (!linkedCaseId) {
      showToast({
        message: "Link this room to a case before promoting durable records.",
        tone: "error",
      })
      return
    }

    try {
      setPromotingArtifactId(artifact.id)
      await createCaseRecordViaApi(
        buildArtifactCasePromotionInput({
          artifact,
          caseId: linkedCaseId,
          roomId,
        }),
      )
      showToast({
        message: `Promoted "${artifact.title}" into the case.`,
        tone: "success",
      })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to promote artifact.",
        tone: "error",
      })
    } finally {
      setPromotingArtifactId(null)
    }
  }

  return (
    <div className="grid w-full gap-3">
      <Card className="border-border/50 bg-background/70 shadow-none">
        <CardHeader className="space-y-2 p-4">
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em]">
          Shared Findings
          </CardDescription>
          <CardTitle>Investigation artifacts</CardTitle>
          <CardDescription className="text-sm leading-6">{status}</CardDescription>
        </CardHeader>
      </Card>

      {artifacts.length === 0 ? (
        <EmptyState message="No promoted findings yet. Send one from the hunt graph to make it available in this rail." />
      ) : null}

      {artifacts.map((artifact) => (
        <Card key={artifact.id} className="border-border/60 bg-card shadow-none">
          <CardContent className="grid gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="text-base font-semibold text-foreground">{artifact.title}</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{artifact.kind}</Badge>
                  <Badge variant="muted">{artifact.sourceModule}</Badge>
                </div>
              </div>
            </div>

            <div className="text-sm leading-6 text-foreground">{artifact.summary}</div>

            {artifact.relatedEntities && artifact.relatedEntities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {artifact.relatedEntities.map((entity) => (
                  <Badge key={`${artifact.id}-${entity.id}`} variant="secondary">
                    {entity.kind}: {entity.label}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">{formatTimestamp(artifact.persistedAt)}</div>
              <div className="flex flex-wrap justify-end gap-2">
                {onCreateActionFromArtifact ? (
                  <Button
                    onClick={() => onCreateActionFromArtifact(artifact)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Create Action
                  </Button>
                ) : null}
                {linkedCaseId ? (
                  <Button
                    disabled={promotingArtifactId === artifact.id}
                    onClick={() => {
                      void handlePromoteToCase(artifact)
                    }}
                    size="sm"
                    type="button"
                  >
                    {promotingArtifactId === artifact.id ? "Promoting..." : "Promote To Case"}
                  </Button>
                ) : null}
                {artifact.deepLink ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={artifact.deepLink.href}>Open Hunt View</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
