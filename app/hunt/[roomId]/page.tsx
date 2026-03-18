import { HuntGraphRoomPage } from "@/features/collab-hunt-graph"
import { requireCasePermissionByRoomId } from "@/lib/auth/access"

type HuntGraphPageProps = {
  params: Promise<{
    roomId: string
  }>
  searchParams: Promise<{
    view?: string
  }>
}

export default async function HuntGraphPage({
  params,
  searchParams,
}: HuntGraphPageProps) {
  const { roomId } = await params
  const currentUser = await requireCasePermissionByRoomId(roomId, "view")
  const { view } = await searchParams

  return (
    <HuntGraphRoomPage
      currentUser={currentUser}
      initialViewId={view ?? null}
      roomId={roomId}
    />
  )
}
