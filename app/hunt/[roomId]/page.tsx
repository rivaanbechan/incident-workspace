import { HuntGraphRoomPage } from "@/features/collab-hunt-graph"
import { requireCasePermissionByRoomId } from "@/lib/auth/access"

type HuntGraphPageProps = {
  params: Promise<{
    roomId: string
  }>
  searchParams: Promise<{
    entityId?: string
    entityKind?: string
    entityLabel?: string
    entityValue?: string
    view?: string
  }>
}

export default async function HuntGraphPage({
  params,
  searchParams,
}: HuntGraphPageProps) {
  const { roomId } = await params
  const currentUser = await requireCasePermissionByRoomId(roomId, "view")
  const { entityId, entityKind, entityLabel, entityValue, view } = await searchParams

  return (
    <HuntGraphRoomPage
      initialEntityFocus={
        entityId && entityLabel
          ? {
              id: entityId,
              kind: entityKind ?? null,
              label: entityLabel,
              value: entityValue ?? entityLabel,
            }
          : null
      }
      initialViewId={view ?? null}
      currentUser={currentUser}
      roomId={roomId}
    />
  )
}
