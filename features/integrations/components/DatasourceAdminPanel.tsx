"use client"

import { apiRequest } from "@/lib/api/client"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  DatasourceConnectionStatus,
  DatasourceDefinition,
  DatasourceInstallation,
} from "@/lib/datasources"
import { cn } from "@/lib/utils"

type DatasourceCatalogResponse = {
  definitions: DatasourceDefinition[]
  datasources: DatasourceInstallation[]
}

type EditorMode = "create" | "edit"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function createEmptyForm(vendor = "splunk") {
  return {
    baseUrl: "",
    enabled: true,
    id: "",
    skipTlsVerify: false,
    title: "",
    token: "",
    vendor,
  }
}

export function DatasourceAdminPanel() {
  const [datasources, setDatasources] = useState<DatasourceInstallation[]>([])
  const [definitions, setDefinitions] = useState<DatasourceDefinition[]>([])
  const [selectedVendor, setSelectedVendor] = useState<string>("splunk")
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>("create")
  const [form, setForm] = useState(createEmptyForm)
  const [status, setStatus] = useState(
    "Choose a vendor card to manage its datasource instances for the whole app.",
  )
  const [connectionStatus, setConnectionStatus] = useState<DatasourceConnectionStatus | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const selectedDefinition =
    definitions.find((definition) => definition.vendor === selectedVendor) ?? null

  const vendorGroups = useMemo(
    () =>
      definitions.map((definition) => {
        const instances = datasources.filter((datasource) => datasource.vendor === definition.vendor)

        return {
          definition,
          enabledCount: instances.filter((instance) => instance.enabled).length,
          instances,
        }
      }),
    [datasources, definitions],
  )

  const currentVendorInstances = datasources.filter(
    (datasource) => datasource.vendor === selectedVendor,
  )

  const selectedInstance =
    currentVendorInstances.find((datasource) => datasource.id === selectedInstanceId) ?? null

  const loadDatasources = useCallback(async () => {
    try {
      setIsLoading(true)
      const payload = await apiRequest<DatasourceCatalogResponse>("/api/datasources", {
        cache: "no-store",
      })
      setDefinitions(payload.definitions)
      setDatasources(payload.datasources)

      const nextVendor =
        payload.definitions.find((definition) => definition.vendor === selectedVendor)?.vendor ??
        payload.definitions[0]?.vendor ??
        "splunk"

      setSelectedVendor(nextVendor)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load datasource instances.")
    } finally {
      setIsLoading(false)
    }
  }, [selectedVendor])

  useEffect(() => {
    void loadDatasources()
  }, [loadDatasources])

  useEffect(() => {
    if (selectedInstance) {
      setEditorMode("edit")
      setForm({
        baseUrl: selectedInstance.baseUrl,
        enabled: selectedInstance.enabled,
        id: selectedInstance.id,
        skipTlsVerify: selectedInstance.skipTlsVerify ?? false,
        title: selectedInstance.title,
        token: "",
        vendor: selectedInstance.vendor,
      })
      setConnectionStatus(null)
      setStatus(`Editing datasource "${selectedInstance.title}".`)
      return
    }

    setEditorMode("create")
    setForm(createEmptyForm(selectedVendor))
    setConnectionStatus(null)
    setStatus(
      selectedDefinition
        ? `Create a new ${selectedDefinition.title} datasource instance.`
        : "Create a new datasource instance.",
    )
  }, [selectedDefinition, selectedInstance, selectedVendor])

  const selectVendor = (vendor: string) => {
    setSelectedVendor(vendor)
    setSelectedInstanceId(null)
  }

  const updateForm = <K extends keyof ReturnType<typeof createEmptyForm>>(
    key: K,
    value: ReturnType<typeof createEmptyForm>[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    const nextId =
      form.id.trim() || slugify(form.title) || `${form.vendor}-${currentVendorInstances.length + 1}`

    try {
      setIsSaving(true)
      setStatus("Saving datasource instance...")
      const saved = await apiRequest<{ title: string }>("/api/datasources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          config: {
            skipTlsVerify: form.skipTlsVerify,
            token: form.token,
          },
          enabled: form.enabled,
          id: nextId,
          title: form.title,
          vendor: form.vendor,
        }),
      })

      setSelectedInstanceId(nextId)
      setEditorMode("edit")
      setForm((current) => ({
        ...current,
        id: nextId,
        token: "",
      }))
      setConnectionStatus(null)
      setStatus(`Saved datasource "${saved.title}".`)
      await loadDatasources()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save datasource instance.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    const targetId = selectedInstance?.id || form.id.trim()

    if (!targetId) {
      setStatus("Save the datasource instance before testing it.")
      return
    }

    try {
      setIsTesting(true)
      setStatus("Testing datasource connection...")
      const result = await apiRequest<DatasourceConnectionStatus>(
        `/api/datasources/${targetId}/test`,
        { method: "POST" },
      )

      setConnectionStatus(result)
      setStatus("Datasource connection test passed.")
    } catch (error) {
      setConnectionStatus(null)
      setStatus(error instanceof Error ? error.message : "Datasource connection test failed.")
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedInstance) {
      return
    }

    const confirmed = window.confirm(
      `Delete datasource "${selectedInstance.title}"? Saved room evidence remains, but this instance will no longer be available for new searches.`,
    )

    if (!confirmed) {
      return
    }

    try {
      setIsDeleting(true)
      setStatus(`Deleting datasource "${selectedInstance.title}"...`)
      await apiRequest(`/api/datasources/${selectedInstance.id}`, { method: "DELETE" })

      setSelectedInstanceId(null)
      setStatus(`Deleted datasource "${selectedInstance.title}".`)
      await loadDatasources()
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to delete datasource instance.",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {vendorGroups.map(({ definition, enabledCount, instances }) => {
          const isSelected = definition.vendor === selectedVendor

          return (
            <button
              key={definition.vendor}
              className={cn(
                "rounded-3xl border bg-card p-6 text-left shadow-sm transition hover:border-primary/30 hover:bg-muted/80",
                isSelected
                  ? "border-primary/40 bg-gradient-to-b from-card to-muted"
                  : "border-border/70",
              )}
              onClick={() => selectVendor(definition.vendor)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Vendor
                  </div>
                  <div className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
                    {definition.title}
                  </div>
                </div>
                <Badge variant="secondary">
                  {instances.length} instance{instances.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {definition.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge
                  variant={definition.capabilities.supportsSearch ? "success" : "muted"}
                >
                  {definition.capabilities.supportsSearch ? "Search" : "No Search"}
                </Badge>
                <Badge
                  variant={definition.capabilities.supportsHealthcheck ? "info" : "muted"}
                >
                  {definition.capabilities.supportsHealthcheck
                    ? "Health Check"
                    : "No Health Check"}
                </Badge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Enabled
                  </div>
                  <div className="mt-1 text-3xl font-semibold text-success">{enabledCount}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Total
                  </div>
                  <div className="mt-1 text-3xl font-semibold text-foreground">{instances.length}</div>
                </div>
              </div>
            </button>
          )
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-2">
              <CardTitle>{selectedDefinition?.title || "Datasource"} instances</CardTitle>
              <CardDescription>
                Select an instance to edit it, or create a new one for this vendor.
              </CardDescription>
            </div>
            <Button onClick={() => setSelectedInstanceId(null)} size="sm" type="button">
              New Instance
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading instances...</div>
            ) : null}

            {!isLoading && currentVendorInstances.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                No instances configured for {selectedDefinition?.title || selectedVendor} yet.
              </div>
            ) : null}

            <div className="grid gap-3">
              {currentVendorInstances.map((instance) => {
                const isSelected = selectedInstanceId === instance.id

                return (
                  <button
                    key={instance.id}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-primary/40 bg-muted"
                        : "border-border/70 bg-card hover:border-primary/20",
                    )}
                    onClick={() => setSelectedInstanceId(instance.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">{instance.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">`{instance.id}`</div>
                      </div>
                      <Badge
                        variant={instance.enabled ? "success" : "warning"}
                      >
                        {instance.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm text-foreground">{instance.baseUrl}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Updated {formatTimestamp(instance.updatedAt)}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-2">
              <CardTitle>
                {editorMode === "create"
                  ? `Create ${selectedDefinition?.title || "Datasource"} instance`
                  : "Edit datasource instance"}
              </CardTitle>
              <CardDescription>{status}</CardDescription>
            </div>
            {selectedInstance ? (
              <Button
                disabled={isDeleting}
                onClick={handleDelete}
                size="sm"
                type="button"
                variant="destructive"
              >
                {isDeleting ? "Deleting..." : "Delete Instance"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 rounded-3xl bg-muted/30 p-5">
              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="grid gap-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    disabled
                    id="vendor"
                    value={selectedDefinition?.title || form.vendor}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="instance-id">Instance ID</Label>
                  <Input
                    id="instance-id"
                    onChange={(event) => updateForm("id", event.target.value)}
                    placeholder={`${selectedVendor}-prod`}
                    value={form.id}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="display-title">Display title</Label>
                <Input
                  id="display-title"
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder={`${selectedDefinition?.title || "Datasource"} Prod`}
                  value={form.title}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  onChange={(event) => updateForm("baseUrl", event.target.value)}
                  placeholder="https://api.example.com"
                  value={form.baseUrl}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="token">
                  Token {selectedInstance ? "(enter only to rotate)" : ""}
                </Label>
                <Input
                  id="token"
                  onChange={(event) => updateForm("token", event.target.value)}
                  placeholder={
                    selectedInstance ? "Leave blank to keep existing token" : "Connector token"
                  }
                  type="password"
                  value={form.token}
                />
              </div>

              <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Checkbox
                  checked={form.enabled}
                  onCheckedChange={(checked) => updateForm("enabled", checked === true)}
                />
                Enabled for the whole app
              </label>

              <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Checkbox
                  checked={form.skipTlsVerify}
                  onCheckedChange={(checked) => updateForm("skipTlsVerify", checked === true)}
                />
                Skip TLS certificate verification
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={isSaving} onClick={handleSave} type="button">
                {isSaving
                  ? "Saving..."
                  : editorMode === "create"
                    ? "Create Instance"
                    : "Save Changes"}
              </Button>
              <Button
                disabled={isTesting || !(selectedInstance || form.id.trim())}
                onClick={handleTest}
                type="button"
                variant="secondary"
              >
                {isTesting ? "Testing..." : "Test Connection"}
              </Button>
              {selectedInstance ? (
                <Button
                  onClick={() => setSelectedInstanceId(null)}
                  type="button"
                  variant="outline"
                >
                  New {selectedDefinition?.title || "Datasource"} Instance
                </Button>
              ) : null}
            </div>

            {connectionStatus ? (
              <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm leading-6 text-success">
                {connectionStatus.message} Checked {formatTimestamp(connectionStatus.checkedAt)}.
              </div>
            ) : null}

            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
              Deleting an instance removes it from future searches. Existing room evidence and
              saved result sets keep their historical datasource metadata.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
