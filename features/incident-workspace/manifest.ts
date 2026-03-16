import type { AppModuleManifest } from "@/lib/modules/types"

export function getIncidentWorkspaceRoomHref(roomId: string) {
  return `/board/${roomId}`
}

export function getIncidentWorkspaceLaunchHref() {
  return "/workspace"
}

export const incidentWorkspaceModule: AppModuleManifest = {
  defaultHref: getIncidentWorkspaceLaunchHref(),
  description:
    "Start a temporary collaborative workspace for fast incident triage, live screen sharing, and shared investigation mapping.",
  id: "incident-workspace",
  routes: [
    {
      href: getIncidentWorkspaceLaunchHref(),
      label: "New Temporary Room",
    },
  ],
  title: "Temp Workspace",
}
