import { requireAuthenticatedUser } from "@/lib/auth/access"
import { redirect } from "next/navigation"

function createTempRoomId() {
  return `temp-${crypto.randomUUID()}`
}

export default async function WorkspaceLauncherPage() {
  await requireAuthenticatedUser()
  redirect(`/board/${createTempRoomId()}`)
}
