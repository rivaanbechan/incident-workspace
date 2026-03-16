import { IncidentWorkspaceRoomPage } from "@/features/incident-workspace"
import { requireCasePermissionByRoomId } from "@/lib/auth/access"

type BoardPageProps = {
  params: Promise<{
    roomId: string
  }>
  searchParams?: Promise<{
    entityId?: string
    entityKind?: string
    entityLabel?: string
    entityValue?: string
    fit?: string
    tab?: string
  }>
}

function parseWorkspaceTab(value?: string) {
  return value === "actions" || value === "feed" || value === "canvas"
    ? value
    : "canvas"
}

export default async function BoardPage({
  params,
  searchParams,
}: BoardPageProps) {
  const { roomId } = await params
  const currentUser = await requireCasePermissionByRoomId(roomId, "view")
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  return (
    <IncidentWorkspaceRoomPage
      autoFitOnOpen={resolvedSearchParams?.fit === "1"}
      initialEntityFocus={
        resolvedSearchParams?.entityId && resolvedSearchParams?.entityLabel
          ? {
              id: resolvedSearchParams.entityId,
              kind: resolvedSearchParams.entityKind ?? null,
              label: resolvedSearchParams.entityLabel,
              value:
                resolvedSearchParams.entityValue ?? resolvedSearchParams.entityLabel,
            }
          : null
      }
      initialTab={parseWorkspaceTab(resolvedSearchParams?.tab)}
      currentUser={currentUser}
      roomId={roomId}
    />
  )
}
