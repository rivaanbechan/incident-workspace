import { AppShell } from "@/components/shell/AppShell"
import { HuntGraphRoomClientLoader } from "@/features/collab-hunt-graph/components/HuntGraphRoomClientLoader"
import { getSavedHuntGraphView, listSavedHuntGraphViews } from "@/features/collab-hunt-graph/lib/storage"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"

type HuntGraphRoomPageProps = {
  currentUser: CaseAccessContext
  initialViewId?: string | null
  roomId: string
}

export async function HuntGraphRoomPage({
  currentUser,
  initialViewId,
  roomId,
}: HuntGraphRoomPageProps) {
  const [initialSavedViews, initialView, platformOverview] = await Promise.all([
    listSavedHuntGraphViews(roomId),
    initialViewId ? getSavedHuntGraphView(roomId, initialViewId) : Promise.resolve(null),
    getPlatformOverview(appModules),
  ])

  return (
    <AppShell
      currentUser={currentUser}
      fullBleed
      modules={appModules}
      platformOverview={platformOverview}
      title="Hunt Graph"
    >
      <HuntGraphRoomClientLoader
        currentUser={currentUser}
        initialSavedViews={initialSavedViews}
        initialView={initialView}
        roomId={roomId}
      />
    </AppShell>
  )
}
