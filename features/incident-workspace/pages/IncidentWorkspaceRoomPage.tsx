import { AppShell } from "@/components/shell/AppShell"
import { BoardShell } from "@/features/incident-workspace/components/board/BoardShell"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import { getPlatformOverview } from "@/lib/db/platform"
import { getInvestigationByRoomId } from "@/lib/db/investigations"
import { appModules } from "@/lib/modules/registry"

type IncidentWorkspaceRoomPageProps = {
  autoFitOnOpen?: boolean
  currentUser: CaseAccessContext
  initialEntityFocus?: {
    id: string
    kind: string | null
    label: string
    value: string
  } | null
  initialTab?: "actions" | "canvas" | "feed"
  roomId: string
}

export async function IncidentWorkspaceRoomPage({
  autoFitOnOpen,
  currentUser,
  initialEntityFocus,
  initialTab,
  roomId,
}: IncidentWorkspaceRoomPageProps) {
  const [investigation, platformOverview] = await Promise.all([
    getInvestigationByRoomId(roomId),
    getPlatformOverview(appModules),
  ])

  return (
    <AppShell
      currentUser={currentUser}
      fullBleed
      modules={appModules}
      platformOverview={platformOverview}
      title="Incident Workspace"
    >
      <BoardShell
        key={`${roomId}:${initialTab ?? "canvas"}:${autoFitOnOpen ? "fit" : "default"}`}
        autoFitOnOpen={autoFitOnOpen}
        currentUser={currentUser}
        initialEntityFocus={initialEntityFocus}
        initialTab={initialTab}
        linkedCaseId={investigation?.id ?? null}
        linkedCaseSeverity={investigation?.severity ?? null}
        linkedCaseStatus={investigation?.status ?? null}
        roomId={roomId}
      />
    </AppShell>
  )
}
