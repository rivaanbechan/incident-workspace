import { CaseDetailPage } from "@/features/cases"

type CaseDetailRoutePageProps = {
  params: Promise<{
    caseId: string
  }>
  searchParams?: Promise<{
    entity?: string
  }>
}

export default async function CaseDetailRoutePage({
  params,
  searchParams,
}: CaseDetailRoutePageProps) {
  const { caseId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  return (
    <CaseDetailPage
      caseId={caseId}
      selectedEntityId={resolvedSearchParams?.entity ?? null}
    />
  )
}
