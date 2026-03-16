import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-xl border-border/60 bg-card/92 shadow-2xl">
        <CardHeader className="space-y-3">
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em]">
            Access denied
          </CardDescription>
          <CardTitle className="text-4xl leading-none tracking-[-0.05em]">
            You do not have permission for this area.
          </CardTitle>
          <CardDescription className="text-sm leading-7">
            Ask an organization admin or a case owner to grant the right role or case membership.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/login">Sign in with another account</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
