import { removeCaseMembershipAction, upsertCaseMembershipAction } from "@/features/admin/actions"
import { Section } from "@/features/cases/components/Section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CASE_ROLE_LABELS } from "@/lib/auth/permissions"
import type { listCaseMemberships } from "@/lib/db/auth"

type CaseMember = Awaited<ReturnType<typeof listCaseMemberships>>[number]

type Props = {
  caseId: string
  caseMembers: CaseMember[]
  currentUserId: string
  canManageMembers: boolean
}

export function CaseMembersPanel({ caseId, caseMembers, currentUserId, canManageMembers }: Props) {
  return (
    <Section title="Access">
      <div className="grid gap-3">
        {caseMembers.map((member) => (
          <div key={member.id} className="grid gap-3 rounded-2xl border border-border/70 p-4">
            <div className="flex items-center gap-3">
              <div className="size-3 shrink-0 rounded-full" style={{ background: member.color }} />
              <div className="grid gap-0.5">
                <span className="text-sm font-semibold">{member.name}</span>
                <span className="text-xs text-muted-foreground">{member.email}</span>
              </div>
            </div>
            <div className="text-sm font-medium text-foreground">{CASE_ROLE_LABELS[member.role]}</div>
            {canManageMembers ? (
              <div className="flex flex-wrap gap-2">
                <form action={upsertCaseMembershipAction} className="flex flex-wrap gap-2">
                  <input name="caseId" type="hidden" value={caseId} />
                  <input name="email" type="hidden" value={member.email} />
                  <Select defaultValue={member.role} name="role">
                    <SelectTrigger className="w-auto min-w-40">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CASE_ROLE_LABELS).map(([role, label]) => (
                        <SelectItem key={role} value={role}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="secondary">Update</Button>
                </form>
                {member.id !== currentUserId ? (
                  <form action={removeCaseMembershipAction}>
                    <input name="caseId" type="hidden" value={caseId} />
                    <input name="userId" type="hidden" value={member.id} />
                    <Button type="submit" variant="destructive">Remove</Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {canManageMembers ? (
        <form action={upsertCaseMembershipAction} className="grid gap-3">
          <input name="caseId" type="hidden" value={caseId} />
          <Input name="email" placeholder="user@example.com" type="email" />
          <Select defaultValue="case_viewer" name="role">
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {Object.entries(CASE_ROLE_LABELS).map(([role, label]) => (
                <SelectItem key={role} value={role}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit">Add member</Button>
        </form>
      ) : (
        <div className="text-sm leading-6 text-muted-foreground">
          Case owners and org admins manage membership for this case.
        </div>
      )}
    </Section>
  )
}
