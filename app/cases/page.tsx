import { CasesIndexPage } from "@/features/cases"

type CasesRoutePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CasesRoutePage({
  searchParams,
}: CasesRoutePageProps) {
  return <CasesIndexPage searchParams={await searchParams} />
}
