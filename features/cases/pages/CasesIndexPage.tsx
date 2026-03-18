import Link from "next/link"
import { Plus, Search, AlertTriangle, CheckCircle2, Clock, FolderOpen, Archive } from "lucide-react"

import { AppShell } from "@/components/shell/AppShell"
import { EmptyState } from "@/components/shell/EmptyState"
import { StatCard } from "@/components/shell/StatCard"
import { FormField } from "@/components/shell/FormField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TooltipProvider } from "@/components/ui/tooltip"
import { createCaseAction } from "@/features/cases/actions"
import { CaseIndexCard } from "@/features/cases/components/CaseIndexCard"
import { CasesFilterBar } from "@/features/cases/components/CasesFilterBar"
import { requireAuthenticatedUser } from "@/lib/auth/access"
import { hasOrgPermission } from "@/lib/auth/permissions"
import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"
import { listCaseIdsForUser } from "@/lib/db/auth"
import { listInvestigations } from "@/lib/db/investigationAggregates"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"

type Props = { searchParams?: Record<string, string | string[] | undefined> }

function readParam(searchParams: Props["searchParams"], key: string) {
  const value = searchParams?.[key]
  return typeof value === "string" ? value : ""
}

export async function CasesIndexPage({ searchParams }: Props) {
  const currentUser = await requireAuthenticatedUser()
  const canCreateCase = currentUser.orgRole === "org_admin" || hasOrgPermission(currentUser.orgRole, "create_case")
  const platformOverview = await getPlatformOverview(appModules)

  const query = readParam(searchParams, "q")
  const archived = readParam(searchParams, "archived") as "active" | "all" | "archived"
  const status = readParam(searchParams, "status") as InvestigationStatus | "all"
  const severity = readParam(searchParams, "severity") as InvestigationSeverity | "all"
  const owner = readParam(searchParams, "owner")
  const updated = readParam(searchParams, "updated") as "all" | "recent"
  const state = readParam(searchParams, "state") as "all" | "closed" | "open"

  const [caseIds, allInvestigations] = await Promise.all([
    hasOrgPermission(currentUser.orgRole, "view_all_cases")
      ? Promise.resolve<string[]>([])
      : listCaseIdsForUser(currentUser.id),
    listInvestigations({ archived: archived || "active", owner, query,
      severity: severity || "all", state: state || "all", status: status || "all", updated: updated || "all" }),
  ])

  const investigations = hasOrgPermission(currentUser.orgRole, "view_all_cases")
    ? allInvestigations
    : allInvestigations.filter((item) => caseIds.includes(item.id))

  const archivedCases = investigations.filter((item) => item.archivedAt).length
  const criticalCases = investigations.filter((item) => item.severity === "critical").length
  const openCases = investigations.filter((item) => item.status !== "closed").length
  const totalOpenActions = investigations.reduce((sum, item) => sum + item.counts.openActionCount, 0)
  const totalFindings = investigations.reduce((sum, item) => sum + item.counts.findingCount, 0)
  const hasActiveFilters = Boolean(
    query || owner || (archived && archived !== "active") || (status && status !== "all") ||
    (severity && severity !== "all") || (updated && updated !== "all") || (state && state !== "all"),
  )

  return (
    <TooltipProvider delayDuration={300}>
      <AppShell currentUser={currentUser} modules={appModules} platformOverview={platformOverview} title="Cases">
        <div className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
              <p className="mt-1 text-muted-foreground">Manage investigations and collaborate in real-time workspaces</p>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <Button asChild variant="outline" size="sm"><Link href="/cases">Clear filters</Link></Button>
              ) : null}
              {canCreateCase ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 size-4" />New Case</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Plus className="size-5 text-primary" />Create New Case
                      </DialogTitle>
                      <DialogDescription>Open a new investigation workspace to collaborate with your team.</DialogDescription>
                    </DialogHeader>
                    <form action={createCaseAction} className="grid gap-4 pt-4">
                      <FormField htmlFor="case-title" label="Title">
                        <Input id="case-title" name="title" placeholder="Enter case title" required className="h-10" />
                      </FormField>
                      <FormField htmlFor="case-summary" label="Summary">
                        <Input id="case-summary" name="summary" placeholder="Brief description of the investigation" className="h-10" />
                      </FormField>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField htmlFor="case-owner" label="Owner">
                          <Input id="case-owner" defaultValue={currentUser.name} name="owner" placeholder="Owner" className="h-10" />
                        </FormField>
                        <FormField htmlFor="case-severity" label="Severity">
                          <Select name="severity" defaultValue="high">
                            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select severity" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                        <Button type="submit">Create Case</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total cases" value={investigations.length} icon={<FolderOpen className="size-5" />} />
            <StatCard label="Open investigations" value={openCases} icon={<Clock className="size-5" />} variant="primary" />
            <StatCard label="Critical severity" icon={<AlertTriangle className="size-5" />} variant="destructive"
              value={<span className={criticalCases > 0 ? "text-destructive" : undefined}>{criticalCases}</span>} />
            <StatCard label="Open actions" value={totalOpenActions} icon={<CheckCircle2 className="size-5" />} variant="success" />
          </div>

          <CasesFilterBar query={query} status={status} severity={severity} archived={archived}
            hasActiveFilters={hasActiveFilters} visibleCount={investigations.length} />

          <div className="space-y-6">
            <Card className="border-border/50 bg-card/95 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {investigations.length} case{investigations.length === 1 ? "" : "s"} found
                  </span>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="border-border/60 bg-background/70 text-xs">{openCases} open</Badge>
                    <Badge variant="secondary" className="text-xs">{totalFindings} findings</Badge>
                    {archivedCases > 0 ? (
                      <Badge variant="muted" className="text-xs">
                        <Archive className="mr-1 size-3" />{archivedCases} archived
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {investigations.length === 0 ? (
              <EmptyState size="lg" icon={<Search className="size-6 text-muted-foreground" />}
                heading="No cases found" message="Try adjusting your filters or create a new case to get started">
                {hasActiveFilters ? (
                  <Button asChild variant="outline" className="mt-2"><Link href="/cases">Clear all filters</Link></Button>
                ) : null}
              </EmptyState>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {investigations.map((caseItem) => <CaseIndexCard key={caseItem.id} caseItem={caseItem} />)}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </TooltipProvider>
  )
}
