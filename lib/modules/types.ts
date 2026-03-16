export type AppModuleRoute = {
  href: string
  label: string
}

export type AppModuleManifest = {
  defaultHref: string
  description: string
  id: string
  routes: AppModuleRoute[]
  title: string
}
