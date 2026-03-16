"use client"

import type {
  CameraState,
  IncidentRoleAssignments,
  IncidentRoleKey,
  IncidentSummary,
} from "@/features/incident-workspace/lib/board/types"
import {
  DEFAULT_CAMERA,
  createIncidentRoleAssignments,
  createIncidentSummary,
  parseIncidentRoleAssignments,
  parseIncidentSummary,
  serializeIncidentRoleAssignments,
  serializeIncidentSummary,
} from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useEffect, useRef, useState } from "react"
import type React from "react"
import * as Y from "yjs"

type UseRoomMetaArgs = {
  metaMapRef: React.RefObject<Y.Map<string> | null>
}

export function useRoomMeta({ metaMapRef }: UseRoomMetaArgs) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef<CameraState>(DEFAULT_CAMERA)

  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA)
  const [incidentSummary, setIncidentSummary] = useState<IncidentSummary>(createIncidentSummary())
  const [incidentRoles, setIncidentRoles] = useState<IncidentRoleAssignments>(
    createIncidentRoleAssignments(),
  )
  const [stageRect, setStageRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  const refreshStageRect = useCallback(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    setStageRect(stage.getBoundingClientRect())
  }, [])

  useEffect(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    refreshStageRect()

    const resizeObserver = new ResizeObserver(refreshStageRect)
    resizeObserver.observe(stage)
    window.addEventListener("resize", refreshStageRect)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", refreshStageRect)
    }
  }, [refreshStageRect])

  const setIncidentSummaryField = useCallback(
    <K extends keyof IncidentSummary>(field: K, value: IncidentSummary[K]) => {
      const metaMap = metaMapRef.current
      const currentSummary =
        parseIncidentSummary(metaMap?.get("incidentSummary")) ?? createIncidentSummary()

      if (!metaMap) {
        return
      }

      metaMap.set(
        "incidentSummary",
        serializeIncidentSummary({ ...currentSummary, [field]: value }),
      )
    },
    [metaMapRef],
  )

  const setIncidentRole = useCallback(
    (role: IncidentRoleKey, value: string) => {
      const metaMap = metaMapRef.current
      const currentRoles =
        parseIncidentRoleAssignments(metaMap?.get("incidentRoles")) ??
        createIncidentRoleAssignments()

      if (!metaMap) {
        return
      }

      metaMap.set(
        "incidentRoles",
        serializeIncidentRoleAssignments({ ...currentRoles, [role]: value }),
      )
    },
    [metaMapRef],
  )

  return {
    camera,
    cameraRef,
    incidentRoles,
    incidentSummary,
    refreshStageRect,
    setCamera,
    setIncidentRole,
    setIncidentRoles,
    setIncidentSummary,
    setIncidentSummaryField,
    stageRect,
    stageRef,
  }
}
