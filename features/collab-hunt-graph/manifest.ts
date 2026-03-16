import type { AppModuleManifest } from "@/lib/modules/types"

export function getCollabHuntGraphHref(roomId = "demo-hunt") {
  return `/hunt/${roomId}`
}

export const collabHuntGraphModule: AppModuleManifest = {
  defaultHref: getCollabHuntGraphHref(),
  description:
    "A room-scoped collaborative Sigma hunt graph with shared live state, datasource adapters, and saved views.",
  id: "collab-hunt-graph",
  routes: [
    {
      href: getCollabHuntGraphHref(),
      label: "Open Hunt Graph",
    },
  ],
  title: "Hunt",
}
