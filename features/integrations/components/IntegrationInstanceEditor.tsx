"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2Icon, XCircleIcon } from "lucide-react"
import { FormField } from "@/components/shell/FormField"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { IntegrationDeleteDialog } from "@/features/integrations/components/IntegrationDeleteDialog"
import { IntegrationLLMFields } from "@/features/integrations/components/IntegrationLLMFields"
import { apiRequest } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type {
  DatasourceConfigPayload,
  DatasourceConnectionStatus,
  DatasourceDefinition,
  DatasourceInstallation,
  StoredDatasourceInstallation,
} from "@/lib/datasources"

type Props = {
  selectedInstance: DatasourceInstallation | null
  selectedDefinition: DatasourceDefinition | null
  selectedVendor: string
  vendorInstanceCount: number
  onSaved: (newId: string) => void
  onDeleted: () => void
  onNewInstance: () => void
}

type Feedback = { message: string; ok: boolean }

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function emptyForm(vendor: string) {
  return { baseUrl: "", defaultModel: "", enabled: true, id: "", maxConcurrent: 1,
    skipTlsVerify: false, supportsToolCalling: false, title: "", token: "", vendor }
}

type FormState = ReturnType<typeof emptyForm>

export function IntegrationInstanceEditor({
  onDeleted,
  onNewInstance,
  onSaved,
  selectedDefinition,
  selectedInstance,
  selectedVendor,
  vendorInstanceCount,
}: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm(selectedVendor))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const isLLM = selectedDefinition?.category === "llm"
  const isCreate = !selectedInstance

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    setFeedback(null)
    setAvailableModels([])

    if (!selectedInstance) {
      setForm(emptyForm(selectedVendor))
      return
    }

    setForm({ baseUrl: selectedInstance.baseUrl, defaultModel: "", enabled: selectedInstance.enabled,
      id: selectedInstance.id, maxConcurrent: 1, skipTlsVerify: selectedInstance.skipTlsVerify ?? false,
      supportsToolCalling: false, title: selectedInstance.title, token: "", vendor: selectedInstance.vendor })

    void apiRequest<StoredDatasourceInstallation>(`/api/datasources/${selectedInstance.id}`)
      .then(async (stored) => {
        const savedModel = typeof stored.config.defaultModel === "string" ? stored.config.defaultModel : ""
        setForm((prev) => ({ ...prev, defaultModel: savedModel,
          maxConcurrent: typeof stored.config.maxConcurrent === "number" ? stored.config.maxConcurrent : 1,
          supportsToolCalling: stored.config.supportsToolCalling === true }))
        if (stored.baseUrl.trim()) {
          const result = await apiRequest<{ models: string[] }>(
            `/api/datasources/models?baseUrl=${encodeURIComponent(stored.baseUrl.trim())}`)
          setAvailableModels(result.models)
        }
      })
      .catch(() => {})
  }, [selectedDefinition, selectedInstance, selectedVendor])

  const handleSave = useCallback(async () => {
    const nextId = form.id.trim() || slugify(form.title) || `${form.vendor}-${vendorInstanceCount + 1}`
    try {
      setIsSaving(true)
      setFeedback(null)
      const saved = await apiRequest<{ title: string }>("/api/datasources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: form.baseUrl, config: { defaultModel: form.defaultModel,
          maxConcurrent: form.maxConcurrent, skipTlsVerify: form.skipTlsVerify,
          supportsToolCalling: form.supportsToolCalling, token: form.token },
          enabled: form.enabled, id: nextId, title: form.title, vendor: form.vendor }),
      })
      setFeedback({ message: `"${saved.title}" saved successfully.`, ok: true })
      onSaved(nextId)
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Save failed.", ok: false })
    } finally {
      setIsSaving(false)
    }
  }, [form, onSaved, vendorInstanceCount])

  const handleTest = useCallback(async () => {
    try {
      setIsTesting(true)
      setFeedback(null)
      if (isLLM) {
        const result = await apiRequest<{ models: string[] }>(
          `/api/datasources/models?baseUrl=${encodeURIComponent(form.baseUrl.trim())}`)
        setAvailableModels(result.models)
        if (!form.defaultModel || !result.models.includes(form.defaultModel))
          updateForm("defaultModel", result.models[0] ?? "")
        const list = result.models.slice(0, 4).join(", ")
        const more = result.models.length > 4 ? ` +${result.models.length - 4} more` : ""
        setFeedback({ ok: true, message: result.models.length > 0
          ? `Connected — models available: ${list}${more}.`
          : "Connected, but no models found. Run `ollama pull <model>` to add one." })
      } else {
        const result = await apiRequest<DatasourceConnectionStatus>(
          `/api/datasources/${selectedInstance!.id}/test`, { method: "POST" })
        setFeedback({ ok: result.ok, message: result.message })
      }
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Connection test failed.", ok: false })
    } finally {
      setIsTesting(false)
    }
  }, [form.baseUrl, form.defaultModel, isLLM, selectedInstance])

  const handleDelete = useCallback(async () => {
    if (!selectedInstance) return
    try {
      setIsDeleting(true)
      await apiRequest(`/api/datasources/${selectedInstance.id}`, { method: "DELETE" })
      setShowDeleteDialog(false)
      onDeleted()
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "Delete failed.", ok: false })
      setIsDeleting(false)
    }
  }, [onDeleted, selectedInstance])

  const testDisabled = isTesting || (isLLM ? !form.baseUrl.trim() : !selectedInstance)
  const cardTitle = isCreate
    ? `New ${selectedDefinition?.title ?? "datasource"} instance`
    : form.title || "Edit instance"

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="space-y-0 pb-4">
        <CardTitle className="text-base">{cardTitle}</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="grid gap-4 rounded-2xl bg-muted/30 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="instance-id" label="Instance ID">
              <Input id="instance-id" onChange={(e) => updateForm("id", e.target.value)}
                placeholder={`${selectedVendor}-prod`} value={form.id}
                disabled={!isCreate} />
            </FormField>
            <FormField htmlFor="display-title" label="Display name">
              <Input id="display-title" onChange={(e) => updateForm("title", e.target.value)}
                placeholder={`${selectedDefinition?.title ?? "Datasource"} Production`} value={form.title} />
            </FormField>
          </div>

          <FormField htmlFor="base-url" label="Base URL">
            <Input id="base-url" onChange={(e) => updateForm("baseUrl", e.target.value)}
              placeholder="https://api.example.com" value={form.baseUrl} />
          </FormField>

          {isLLM ? (
            <IntegrationLLMFields availableModels={availableModels} defaultModel={form.defaultModel}
              isTesting={isTesting} maxConcurrent={form.maxConcurrent}
              onMaxConcurrentChange={(v) => updateForm("maxConcurrent", v)}
              onModelChange={(v) => updateForm("defaultModel", v)}
              onSupportsToolCallingChange={(v) => updateForm("supportsToolCalling", v)}
              supportsToolCalling={form.supportsToolCalling} />
          ) : null}

          <FormField htmlFor="token"
            label={selectedInstance ? "Token (leave blank to keep existing)" : "Token"}>
            <Input id="token" onChange={(e) => updateForm("token", e.target.value)} type="password"
              placeholder={selectedInstance ? "••••••••" : "Connector token or API key"}
              value={form.token} />
          </FormField>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
              <Checkbox checked={form.enabled}
                onCheckedChange={(v) => updateForm("enabled", v === true)} />
              Enabled
            </label>
            <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
              <Checkbox checked={form.skipTlsVerify}
                onCheckedChange={(v) => updateForm("skipTlsVerify", v === true)} />
              Skip TLS verification
            </label>
          </div>
        </div>

        {feedback ? (
          <div className={cn(
            "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
            feedback.ok
              ? "border-success/25 bg-success/10 text-success"
              : "border-destructive/25 bg-destructive/10 text-destructive",
          )}>
            {feedback.ok
              ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
              : <XCircleIcon className="mt-0.5 size-4 shrink-0" />}
            {feedback.message}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={isSaving} onClick={handleSave} type="button">
            {isSaving ? "Saving…" : isCreate ? "Create instance" : "Save changes"}
          </Button>
          <Button disabled={testDisabled} onClick={handleTest} type="button" variant="secondary">
            {isTesting ? "Testing…" : "Test connection"}
          </Button>
          {selectedInstance ? (
            <>
              <Separator className="mx-1 h-5" orientation="vertical" />
              <Button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Delete instance
              </Button>
            </>
          ) : null}
        </div>

        {!isCreate ? (
          <p className="text-xs text-muted-foreground">
            Deleting an instance removes it from future searches. Saved room evidence and result
            sets keep their historical metadata.
          </p>
        ) : null}
      </CardContent>

      {selectedInstance && showDeleteDialog ? (
        <IntegrationDeleteDialog instance={selectedInstance} isDeleting={isDeleting}
          onClose={() => setShowDeleteDialog(false)} onConfirm={handleDelete} open={showDeleteDialog} />
      ) : null}
    </Card>
  )
}
