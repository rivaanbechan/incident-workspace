import type { AppModuleManifest } from "@/lib/modules/types"

export function getCasesHref() {
  return "/cases"
}

export function getCaseDetailHref(caseId: string) {
  return `/cases/${caseId}`
}

export const casesModule: AppModuleManifest = {
  defaultHref: getCasesHref(),
  description:
    "The durable investigation index for the platform, with linked workspace rooms and read-heavy case detail.",
  id: "cases",
  routes: [
    {
      href: getCasesHref(),
      label: "Open Cases",
    },
  ],
  title: "Cases",
}
