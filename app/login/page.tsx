import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { LoginForm } from "@/components/auth/LoginForm"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

function getErrorMessage(error?: string) {
  if (error === "CredentialsSignin") {
    return "Invalid email or password."
  }

  return ""
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth()

  if (session?.user?.id) {
    redirect("/")
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const errorMessage = getErrorMessage(resolvedSearchParams?.error)
  const callbackUrl = process.env.APP_BASE_URL?.trim() || "https://incident.local"
  const bootstrapConfigured = Boolean(
    process.env.AUTH_BOOTSTRAP_EMAIL?.trim() && process.env.AUTH_BOOTSTRAP_PASSWORD?.trim(),
  )

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 size-[500px] rounded-full bg-primary/8 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-accent/40 blur-3xl" />
      <Card className="relative w-full max-w-md border-border/60 bg-card/95 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-3">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
            Incident Workspace
          </CardDescription>
          <CardTitle className="text-4xl leading-none tracking-[-0.05em]">Sign in</CardTitle>
          <CardDescription className="text-sm leading-6">
            Use an organization account to access cases, rooms, integrations, and admin features.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <LoginForm callbackUrl={callbackUrl} errorMessage={errorMessage} />

          <Alert className="border-border/10 bg-background text-foreground">
            <AlertDescription>
          {bootstrapConfigured ? (
            "Bootstrap login is enabled from environment variables. After your first login, create additional users from the admin page."
          ) : (
            <>
              No bootstrap user is configured yet. Set `AUTH_BOOTSTRAP_EMAIL` and
              `AUTH_BOOTSTRAP_PASSWORD`, then restart the app.
            </>
          )}
            </AlertDescription>
          </Alert>

          <Button asChild variant="link" className="justify-start px-0">
            <Link href="/unauthorized">Access help</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
