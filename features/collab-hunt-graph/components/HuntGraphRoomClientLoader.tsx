"use client"

import dynamic from "next/dynamic"

import type { CaseAccessContext } from "@/lib/auth/permissions"
import type {
  SavedHuntGraphViewDetail,
  SavedHuntGraphViewRecord,
} from "@/features/collab-hunt-graph/lib/types"

const HuntGraphRoomClient = dynamic(
  () =>
    import("@/features/collab-hunt-graph/components/HuntGraphRoomClient").then(
      (m) => ({ default: m.HuntGraphRoomClient }),
    ),
  { ssr: false },
)

type Props = {
  currentUser: CaseAccessContext
  initialEntityFocus: {
    id: string
    kind: string | null
    label: string
    value: string
  } | null
  initialSavedViews: SavedHuntGraphViewRecord[]
  initialView: SavedHuntGraphViewDetail | null
  roomId: string
}

export function HuntGraphRoomClientLoader(props: Props) {
  return <HuntGraphRoomClient {...props} />
}
