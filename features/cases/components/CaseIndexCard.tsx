import Link from "next/link"
import { ArrowRight, CheckCircle2, LayoutGrid, List, Archive } from "lucide-react"
import { TonedCard } from "@/components/shell/TonedCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getCaseDetailHref } from "@/features/cases/manifest"
import { formatTimestamp, getSeverityBadgeVariant, getStatusBadgeVariant } from "@/features/cases/lib/formatters"
import { getSeveritySurfaceTone } from "@/lib/ui/tones"
import type { InvestigationOverview } from "@/lib/contracts/investigations"

type Props = {
  caseItem: InvestigationOverview
}

export function CaseIndexCard({ caseItem }: Props) {
  const tone = getSeveritySurfaceTone(caseItem.severity)

  return (
    <TonedCard
      tint={tone.tint}
      accent={tone.accent}
      className="group flex h-full flex-col border-border/50 bg-card/95 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <CardTitle className="line-clamp-2 cursor-default text-base font-semibold leading-tight">
                {caseItem.title}
              </CardTitle>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>{caseItem.title}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Badge variant={getStatusBadgeVariant(caseItem.status)} className="text-[10px] font-semibold uppercase tracking-wider">
            {caseItem.status}
          </Badge>
          <Badge variant={getSeverityBadgeVariant(caseItem.severity)} className="text-[10px] font-semibold uppercase tracking-wider">
            {caseItem.severity}
          </Badge>
          {caseItem.archivedAt ? (
            <Badge variant="muted" className="text-[10px]">
              <Archive className="mr-1 size-3" />
              Archived
            </Badge>
          ) : null}
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
            <Card key={item.label} className="border-border/50 bg-background/75 shadow-none transition-colors group-hover:bg-background">
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
            <Link href={getCaseDetailHref(caseItem.id)}>Open</Link>
          </Button>
          <Button asChild className="group/btn flex-1" size="sm">
            <Link href={`/board/${caseItem.roomId}`}>
              Workspace
              <ArrowRight className="ml-1 size-4 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </TonedCard>
  )
}
