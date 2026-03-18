type Props = {
  raw: Record<string, unknown>
}

export function DatasourceRawEventView({ raw }: Props) {
  const rawText = typeof raw._raw === "string" ? raw._raw.trim() : null
  const fields = Object.entries(raw).filter(([key]) => !key.startsWith("_"))

  return (
    <div className="grid gap-3">
      {rawText ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Raw event
          </div>
          <pre className="whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-5 text-foreground">
            {rawText}
          </pre>
        </div>
      ) : null}
      {fields.length > 0 ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Fields
          </div>
          <div className="grid gap-0.5">
            {fields.map(([key, value]) => (
              <div key={key} className="flex gap-2 font-mono text-[11px] leading-5">
                <span className="shrink-0 text-muted-foreground">{key}</span>
                <span className="break-all text-foreground">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
