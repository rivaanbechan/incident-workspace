// Deep links are the shell-safe way for one module to tell another module
// "open this route with this specific context".
export type ModuleDeepLink = {
  href: string
  moduleId: string
  // Use context IDs rather than large inline objects where possible.
  // The receiving module can resolve the ID from its own storage layer later.
  contextId?: string
  params?: Record<string, string>
}
