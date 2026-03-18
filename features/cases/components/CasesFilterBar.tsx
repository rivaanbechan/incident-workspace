import Link from "next/link"
import { Filter, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Props = {
  query: string
  status: string
  severity: string
  archived: string
  hasActiveFilters: boolean
  visibleCount: number
}

export function CasesFilterBar({ query, status, severity, archived, hasActiveFilters, visibleCount }: Props) {
  return (
    <Card className="border-border/50 bg-card/95 shadow-sm">
      <CardHeader className="gap-3 border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Filter investigations</CardTitle>
            <CardDescription>
              Narrow the case list by severity, status, visibility, and free-text search.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-border/60 bg-background/70">
            {visibleCount} visible
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
  )
}
