import type { DefaultSession } from "next-auth"

import type { OrgRole } from "@/lib/auth/permissions"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      color: string
      id: string
      orgId: string
      orgRole: OrgRole
    }
  }
}
