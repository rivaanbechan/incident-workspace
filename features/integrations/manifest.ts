import type { AppModuleManifest } from "@/lib/modules/types"

export function getIntegrationsHref() {
  return "/integrations"
}

export const integrationsModule: AppModuleManifest = {
  defaultHref: getIntegrationsHref(),
  description:
    "Global datasource administration for configuring, testing, and enabling platform-wide integrations.",
  id: "integrations",
  routes: [
    {
      href: getIntegrationsHref(),
      label: "Open Integrations",
    },
  ],
  title: "Integrations",
}
