"use client"

import type { IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"
import { useEffect, useRef } from "react"

type IncidentAction = {
  id: string
  owner: string
  status: string
  title: string
}

type BoardUser = {
  name: string
}

type UseNotificationsArgs = {
  incidentActions: IncidentAction[]
  incidentLog: IncidentLogEntry[]
  isSynced: boolean
  user: BoardUser
}

export function useNotifications({
  incidentActions,
  incidentLog,
  isSynced,
  user,
}: UseNotificationsArgs) {
  const assignmentSnapshotRef = useRef<Map<string, string>>(new Map())
  const actionStatusSnapshotRef = useRef<Map<string, string>>(new Map())
  const incidentLogSnapshotRef = useRef<Set<string>>(new Set())
  const hasInitializedAssignmentsRef = useRef(false)
  const hasInitializedActionStatusesRef = useRef(false)
  const hasInitializedIncidentLogRef = useRef(false)
  const notificationPermissionRequestedRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isSynced) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "default") return
    if (notificationPermissionRequestedRef.current) return
    notificationPermissionRequestedRef.current = true
    void Notification.requestPermission()
  }, [isSynced])

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return
    }

    if (!isSynced) {
      return
    }

    const dispatchNotifications = (title: string, bodies: string[]) => {
      const notify = () => {
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker.ready
            .then((registration) => {
              bodies.forEach((body) => {
                void registration.showNotification(title, { body })
              })
            })
            .catch(() => {
              bodies.forEach((body) => {
                new Notification(title, { body })
              })
            })
        } else {
          bodies.forEach((body) => {
            new Notification(title, { body })
          })
        }
      }

      if (Notification.permission === "granted") {
        notify()
        return
      }

      if (
        Notification.permission === "default" &&
        !notificationPermissionRequestedRef.current
      ) {
        notificationPermissionRequestedRef.current = true
        void Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            notify()
          }
        })
      }
    }

    const currentAssignments = new Map(
      incidentActions.map((action) => [action.id, action.owner]),
    )
    const currentStatuses = new Map(
      incidentActions.map((action) => [action.id, action.status]),
    )
    const currentIncidentLogIds = new Set(incidentLog.map((entry) => entry.id))

    const isFirstAssignmentSnapshot = !hasInitializedAssignmentsRef.current
    const isFirstStatusSnapshot = !hasInitializedActionStatusesRef.current
    const isFirstIncidentLogSnapshot = !hasInitializedIncidentLogRef.current

    if (isFirstAssignmentSnapshot) {
      assignmentSnapshotRef.current = currentAssignments
      hasInitializedAssignmentsRef.current = true
    }

    if (isFirstStatusSnapshot) {
      actionStatusSnapshotRef.current = currentStatuses
      hasInitializedActionStatusesRef.current = true
    }

    if (isFirstIncidentLogSnapshot) {
      incidentLogSnapshotRef.current = currentIncidentLogIds
      hasInitializedIncidentLogRef.current = true
    }

    if (isFirstAssignmentSnapshot || isFirstStatusSnapshot || isFirstIncidentLogSnapshot) {
      return
    }

    const newlyAssigned = incidentActions.filter((action) => {
      const previousOwner = assignmentSnapshotRef.current.get(action.id) ?? ""

      return action.owner === user.name && previousOwner !== user.name
    })
    const newlyCompleted = incidentActions.filter((action) => {
      const previousStatus = actionStatusSnapshotRef.current.get(action.id)

      return previousStatus !== "done" && action.status === "done"
    })
    const newTimelineEntries = incidentLog.filter(
      (entry) => !incidentLogSnapshotRef.current.has(entry.id),
    )

    assignmentSnapshotRef.current = currentAssignments
    actionStatusSnapshotRef.current = currentStatuses
    incidentLogSnapshotRef.current = currentIncidentLogIds

    if (newlyAssigned.length > 0) {
      dispatchNotifications(
        "Task assigned to you",
        newlyAssigned.map((action) => `${action.title}\nAssigned in incident room`),
      )
    }

    if (newlyCompleted.length > 0) {
      dispatchNotifications(
        "Task completed",
        newlyCompleted.map((action) => {
          const actor = action.owner.trim() || "Someone"

          return `${actor} completed a task: ${action.title}`
        }),
      )
    }

    if (newTimelineEntries.length > 0) {
      dispatchNotifications(
        "Feed updated",
        newTimelineEntries.map((entry) => {
          const headline = entry.body.split("\n")[0]?.trim() || "New timeline entry"

          return `${entry.authorName} updated the feed: ${headline}`
        }),
      )
    }
  }, [incidentActions, incidentLog, isSynced, user.name])
}
