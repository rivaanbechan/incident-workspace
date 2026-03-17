"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { FormField } from "@/components/shell/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type LoginFormProps = {
  callbackUrl: string
  errorMessage?: string
}

export function LoginForm({ callbackUrl, errorMessage = "" }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState(errorMessage)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setLocalError("")

    const response = await signIn("credentials", {
      callbackUrl,
      email,
      password,
      redirect: false,
    })

    setIsSubmitting(false)

    if (!response) {
      setLocalError("Unable to complete sign in.")
      return
    }

    if (response.error) {
      setLocalError("Invalid email or password.")
      return
    }

    window.location.assign(response.url || "/")
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <FormField htmlFor="email" label="Email">
        <Input
          autoComplete="email"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </FormField>

      <FormField htmlFor="password" label="Password">
        <Input
          autoComplete="current-password"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </FormField>

      {localError ? (
        <Alert variant="destructive">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}

      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  )
}
