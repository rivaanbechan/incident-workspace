import type { AppModuleManifest } from "@/lib/modules/types"

export function getAgentsHref() {
  return "/agents"
}

export const agentsModule: AppModuleManifest = {
  defaultHref: getAgentsHref(),
  description: "Configure AI agents that analysts can invoke during investigations.",
  id: "agents",
  routes: [
    {
      href: getAgentsHref(),
      label: "Open AI Agents",
    },
  ],
  title: "AI Agents",
}
