import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { getAuthenticatedUserById, verifyUserPassword } from "@/lib/db/auth"

export const { auth, handlers, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase()
        const password = String(credentials?.password ?? "")

        if (!email || !password) {
          return null
        }

        const user = await verifyUserPassword(email, password)

        if (!user) {
          return null
        }

        return {
          email: user.email,
          id: user.id,
          name: user.name,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      const appBaseUrl = process.env.APP_BASE_URL?.trim() || "https://incident.local"

      if (url.startsWith("/")) {
        return `${appBaseUrl}${url}`
      }

      try {
        const target = new URL(url)

        if (
          target.origin === baseUrl ||
          target.origin === process.env.NEXTAUTH_URL ||
          target.origin === process.env.AUTH_URL
        ) {
          return url.replace(target.origin, appBaseUrl)
        }
      } catch {
        return appBaseUrl
      }

      return appBaseUrl
    },
    async session({ session, token }) {
      if (!token.sub) {
        return session
      }

      const user = await getAuthenticatedUserById(token.sub)

      if (!user) {
        return session
      }

      session.user = {
        ...session.user,
        color: user.color,
        email: user.email,
        id: user.id,
        name: user.name,
        orgId: user.orgId,
        orgRole: user.orgRole,
      }

      return session
    },
  },
})
