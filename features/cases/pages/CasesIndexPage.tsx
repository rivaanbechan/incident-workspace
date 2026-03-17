import Link from "next/link"
import { Plus, Filter, Search, ArrowRight, LayoutGrid, List, FolderOpen, AlertTriangle, CheckCircle2, Clock, Archive, X } from "lucide-react"

import { AppShell } from "@/components/shell/AppShell"
import { EmptyState } from "@/components/shell/EmptyState"
import { TonedCard } from "@/components/shell/TonedCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { createCaseAction } from "@/features/cases/actions"
import { getCaseDetailHref } from "@/features/cases/manifest"
import { getSeveritySurfaceTone } from "@/lib/ui/tones"
import {
  formatTimestamp,
  getSeverityBadgeVariant,
  getStatusBadgeVariant,
} from "@/features/cases/lib/formatters"
import { FormField } from "@/components/shell/FormField"
import { StatCard } from "@/components/shell/StatCard"
import { requireAuthenticatedUser } from "@/lib/auth/access"
import type {
  InvestigationSeverity,
  InvestigationStatus,
} from "@/lib/contracts/investigations"
import { listCaseIdsForUser } from "@/lib/db/auth"
import { listInvestigations } from "@/lib/db/investigationAggregates"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"
import { hasOrgPermission } from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"

type CasesIndexPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function readSearchParam(
  searchParams: CasesIndexPageProps["searchParams"],
  key: string,
) {
  const value = searchParams?.[key]
  return typeof value === "string" ? value : ""
}


export async function CasesIndexPage({ searchParams }: CasesIndexPageProps) {
  const currentUser = await requireAuthenticatedUser()
  const canCreateCase =
    currentUser.orgRole === "org_admin" ||
    hasOrgPermission(currentUser.orgRole, "create_case")
  const platformOverview = await getPlatformOverview(appModules)
  const query = readSearchParam(searchParams, "q")
  const archived = readSearchParam(searchParams, "archived") as
    | "active"
    | "all"
    | "archived"
  const status = readSearchParam(searchParams, "status") as InvestigationStatus | "all"
  const severity = readSearchParam(searchParams, "severity") as
    | InvestigationSeverity
    | "all"
  const owner = readSearchParam(searchParams, "owner")
  const updated = readSearchParam(searchParams, "updated") as "all" | "recent"
  const state = readSearchParam(searchParams, "state") as "all" | "closed" | "open"

  const [caseIds, allInvestigations] = await Promise.all([
    hasOrgPermission(currentUser.orgRole, "view_all_cases")
      ? Promise.resolve<string[]>([])
      : listCaseIdsForUser(currentUser.id),
    listInvestigations({
      archived: archived || "active",
      owner,
      query,
      severity: severity || "all",
      state: state || "all",
      status: status || "all",
      updated: updated || "all",
    }),
  ])

  const investigations = hasOrgPermission(currentUser.orgRole, "view_all_cases")
    ? allInvestigations
    : allInvestigations.filter((item) => caseIds.includes(item.id))

  const archivedCases = investigations.filter((item) => item.archivedAt).length
  const criticalCases = investigations.filter((item) => item.severity === "critical").length
  const openCases = investigations.filter((item) => item.status !== "closed").length
  const totalOpenActions = investigations.reduce(
    (sum, item) => sum + item.counts.openActionCount,
    0,
  )
  const totalFindings = investigations.reduce((sum, item) => sum + item.counts.findingCount, 0)
  const hasActiveFilters = Boolean(
    query ||
      owner ||
      (archived && archived !== "active") ||
      (status && status !== "all") ||
      (severity && severity !== "all") ||
      (updated && updated !== "all") ||
      (state && state !== "all"),
  )

  return (
    <TooltipProvider delayDuration={300}>
      <AppShell
        currentUser={currentUser}
        modules={appModules}
        platformOverview={platformOverview}
        title="Cases"
      >
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
              <p className="mt-1 text-muted-foreground">
                Manage investigations and collaborate in real-time workspaces
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/cases">Clear filters</Link>
                </Button>
              )}
              {canCreateCase && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 size-4" />
                      New Case
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Plus className="size-5 text-primary" />
                        Create New Case
                      </DialogTitle>
                      <DialogDescription>
                        Open a new investigation workspace to collaborate with your team.
                      </DialogDescription>
                    </DialogHeader>
                    <form action={createCaseAction} className="grid gap-4 pt-4">
                      <FormField htmlFor="case-title" label="Title">
                        <Input
                          id="case-title"
                          name="title"
                          placeholder="Enter case title"
                          required
                          className="h-10"
                        />
                      </FormField>
                      <FormField htmlFor="case-summary" label="Summary">
                        <Input
                          id="case-summary"
                          name="summary"
                          placeholder="Brief description of the investigation"
                          className="h-10"
                        />
                      </FormField>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField htmlFor="case-owner" label="Owner">
                          <Input
                            id="case-owner"
                            defaultValue={currentUser.name}
                            name="owner"
                            placeholder="Owner"
                            className="h-10"
                          />
                        </FormField>
                        <FormField htmlFor="case-severity" label="Severity">
                          <Select name="severity" defaultValue="high">
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
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
                        <DialogClose asChild>
                          <Button variant="outline" type="button">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Create Case</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total cases"
              value={investigations.length}
              icon={<FolderOpen className="size-5" />}
            />
            <StatCard
              label="Open investigations"
              value={openCases}
              icon={<Clock className="size-5" />}
              variant="primary"
            />
            <StatCard
              label="Critical severity"
              value={
                <span className={criticalCases > 0 ? "text-destructive" : undefined}>
                  {criticalCases}
                </span>
              }
              icon={<AlertTriangle className="size-5" />}
              variant="destructive"
            />
            <StatCard
              label="Open actions"
              value={totalOpenActions}
              icon={<CheckCircle2 className="size-5" />}
              variant="success"
            />
          </div>

          <Card className="border-border/50 bg-card/95 shadow-sm">
            <CardHeader className="gap-3 border-b border-border/40 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className={cn(
                  "space-y-1",
                )}>
                  <CardTitle className="text-base">Filter investigations</CardTitle>
                  <CardDescription>
                    Narrow the case list by severity, status, visibility, and free-text search.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-border/60 bg-background/70">
                  {investigations.length} visible
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <form method="GET" className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto]">
                <div className="relative min-w-0">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    defaultValue={query}
                    name="q"
                    placeholder="Search cases..."
                    className="h-10 border-border/60 bg-background pl-9"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <Select name="status" defaultValue={status || "all"}>
                    <SelectTrigger className="h-10 w-[148px] border-border/60 bg-background">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="monitoring">Monitoring</SelectItem>
                      <SelectItem value="mitigated">Mitigated</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select name="severity" defaultValue={severity || "all"}>
                    <SelectTrigger className="h-10 w-[148px] border-border/60 bg-background">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select name="archived" defaultValue={archived || "active"}>
                    <SelectTrigger className="h-10 w-[148px] border-border/60 bg-background">
                      <SelectValue placeholder="Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters ? (
                    <Button asChild size="sm" variant="ghost" className="h-10 px-3">
                      <Link href="/cases">
                        <X className="mr-1.5 size-4" />
                        Clear
                      </Link>
                    </Button>
                  ) : null}

                  <Button type="submit" size="sm" className="h-10 px-4">
                    <Filter className="mr-1 size-4" />
                    Apply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Results Header */}
            <Card className="border-border/50 bg-card/95 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {investigations.length} case{investigations.length === 1 ? "" : "s"} found
                  </span>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className="border-border/60 bg-background/70 text-xs">
                      {openCases} open
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {totalFindings} findings
                    </Badge>
                    {archivedCases > 0 && (
                      <Badge variant="muted" className="text-xs">
                        <Archive className="mr-1 size-3" />
                        {archivedCases} archived
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cases Grid */}
            {investigations.length === 0 ? (
              <EmptyState
                size="lg"
                icon={<Search className="size-6 text-muted-foreground" />}
                heading="No cases found"
                message="Try adjusting your filters or create a new case to get started"
              >
                {hasActiveFilters && (
                  <Button asChild variant="outline" className="mt-2">
                    <Link href="/cases">Clear all filters</Link>
                  </Button>
                )}
              </EmptyState>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {investigations.map((caseItem) => {
                  const tone = getSeveritySurfaceTone(caseItem.severity)

                  return (
                  <TonedCard
                    key={caseItem.id}
                    tint={tone.tint}
                    accent={tone.accent}
                    className="group flex h-full flex-col border-border/50 bg-card/95 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <CardHeader className="pb-3 pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CardTitle className="line-clamp-2 text-base font-semibold leading-tight cursor-default">
                              {caseItem.title}
                            </CardTitle>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p>{caseItem.title}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        <Badge 
                          variant={getStatusBadgeVariant(caseItem.status)} 
                          className="text-[10px] uppercase tracking-wider font-semibold"
                        >
                          {caseItem.status}
                        </Badge>
                        <Badge 
                          variant={getSeverityBadgeVariant(caseItem.severity)} 
                          className="text-[10px] uppercase tracking-wider font-semibold"
                        >
                          {caseItem.severity}
                        </Badge>
                        {caseItem.archivedAt && (
                          <Badge variant="muted" className="text-[10px]">
                            <Archive className="mr-1 size-3" />
                            Archived
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 space-y-4">
                      <CardDescription className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {caseItem.summary || "No summary provided for this investigation."}
                      </CardDescription>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Findings", value: caseItem.counts.findingCount, icon: LayoutGrid },
                          { label: "Actions", value: caseItem.counts.openActionCount, icon: CheckCircle2 },
                          { label: "Entities", value: caseItem.counts.entityCount, icon: List },
                        ].map((item) => (
                          <Card
                            key={item.label} 
                            className="border-border/50 bg-background/75 shadow-none transition-colors group-hover:bg-background"
                          >
                            <CardContent className="p-2.5 text-center">
                              <div className="mb-1 flex justify-center text-muted-foreground">
                                <item.icon className="size-3.5" />
                              </div>
                              <div className="text-xl font-bold tracking-tight">{item.value}</div>
                              <CardDescription className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {item.label}
                              </CardDescription>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <Separator className="opacity-40" />

                      <Card className="border-border/50 bg-background/70 shadow-none">
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-muted-foreground">Owner</span>
                            <span className="font-semibold text-foreground">{caseItem.owner}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-muted-foreground">Updated</span>
                            <span className="tabular-nums text-muted-foreground">{formatTimestamp(caseItem.updatedAt)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>

                    <CardContent className="pt-0">
                      <div className="flex gap-2">
                        <Button asChild variant="outline" className="flex-1" size="sm">
                          <Link href={getCaseDetailHref(caseItem.id)}>
                            Open
                          </Link>
                        </Button>
                        <Button asChild className="flex-1 group/btn" size="sm">
                          <Link href={`/board/${caseItem.roomId}`}>
                            Workspace
                            <ArrowRight className="ml-1 size-4 transition-transform group-hover/btn:translate-x-0.5" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </TonedCard>
                )})}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </TooltipProvider>
  )
}
