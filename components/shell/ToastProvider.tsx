"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CheckCircle2, CircleAlert, Info } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastTone = "error" | "info" | "success"

type ToastInput = {
  message: string
  tone?: ToastTone
}

type ToastRecord = {
  id: string
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (toast: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION_MS = 3200

const toneStyles: Record<ToastTone, { className: string; icon: typeof Info }> = {
  error: {
    className: "border-destructive/35 bg-destructive/95 text-destructive-foreground",
    icon: CircleAlert,
  },
  info: {
    className: "border-border/50 bg-muted/95 text-foreground",
    icon: Info,
  },
  success: {
    className: "border-success/30 bg-success/95 text-success-foreground",
    icon: CheckCircle2,
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((toastId: string) => {
    const timerId = timersRef.current.get(toastId)

    if (timerId) {
      window.clearTimeout(timerId)
      timersRef.current.delete(toastId)
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const showToast = useCallback(
    ({ message, tone = "info" }: ToastInput) => {
      const toastId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`

      setToasts((current) => [...current, { id: toastId, message, tone }])

      const timerId = window.setTimeout(() => {
        dismissToast(toastId)
      }, TOAST_DURATION_MS)

      timersRef.current.set(toastId, timerId)
    },
    [dismissToast],
  )

  useEffect(() => {
    const timers = timersRef.current

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId))
      timers.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[200] flex flex-col gap-3">
        {toasts.map((toast) => {
          const toneStyle = toneStyles[toast.tone]
          const Icon = toneStyle.icon

          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex min-w-[280px] max-w-[420px] items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold leading-6 shadow-2xl backdrop-blur",
                toneStyle.className,
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              {toast.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.")
  }

  return context
}
