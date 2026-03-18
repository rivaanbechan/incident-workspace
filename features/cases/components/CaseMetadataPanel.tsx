import {
  archiveCaseAction,
  deleteCasePermanentlyAction,
  restoreCaseAction,
  updateCaseMetadataAction,
} from "@/features/cases/actions"
import { Section } from "@/features/cases/components/Section"
import { formatTimestamp } from "@/features/cases/lib/formatters"
import { FormField } from "@/components/shell/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Investigation } from "@/lib/contracts/investigations"

type Props = {
  investigation: Investigation
}

export function CaseMetadataPanel({ investigation }: Props) {
  return (
    <Section title="Case Metadata">
      <form action={updateCaseMetadataAction} className="grid gap-3">
        <input type="hidden" name="caseId" value={investigation.id} />
        <FormField htmlFor="case-title" label="Title">
          <Input id="case-title" name="title" defaultValue={investigation.title} />
        </FormField>
        <FormField htmlFor="case-summary" label="Summary">
          <Textarea id="case-summary" name="summary" defaultValue={investigation.summary} rows={6} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField htmlFor="case-status" label="Status">
            <Select name="status" defaultValue={investigation.status}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="mitigated">Mitigated</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="case-severity" label="Severity">
            <Select name="severity" defaultValue={investigation.severity}>
              <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField htmlFor="case-owner" label="Owner">
            <Input id="case-owner" name="owner" defaultValue={investigation.owner} />
          </FormField>
        </div>
        <Button type="submit">Save Metadata</Button>
      </form>

      <div className="grid gap-2 text-xs text-muted-foreground">
        <div>Case ID: {investigation.id}</div>
        <div>Room ID: {investigation.roomId}</div>
        <div>Archived {investigation.archivedAt ? formatTimestamp(investigation.archivedAt) : "No"}</div>
        <div>Created {formatTimestamp(investigation.createdAt)}</div>
        <div>Updated {formatTimestamp(investigation.updatedAt)}</div>
      </div>

      <div className="grid gap-3 pt-2">
        {investigation.archivedAt ? (
          <form action={restoreCaseAction}>
            <input type="hidden" name="caseId" value={investigation.id} />
            <Button className="w-full bg-success hover:bg-success/90" type="submit">Restore Case</Button>
          </form>
        ) : (
          <form action={archiveCaseAction}>
            <input type="hidden" name="caseId" value={investigation.id} />
            <Button className="w-full bg-warning text-warning-foreground hover:bg-warning/90" type="submit">
              Archive Case
            </Button>
          </form>
        )}
        <form action={deleteCasePermanentlyAction} className="grid gap-2">
          <input type="hidden" name="caseId" value={investigation.id} />
          <Label className="text-critical">
            Type DELETE to permanently remove this case and its linked room data.
          </Label>
          <Input className="border-critical/20" name="confirmation" placeholder="DELETE" />
          <Button type="submit" variant="destructive">Delete Permanently</Button>
        </form>
      </div>
    </Section>
  )
}
