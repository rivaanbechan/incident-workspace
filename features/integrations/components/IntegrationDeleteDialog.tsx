"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DatasourceInstallation } from "@/lib/datasources"

type Props = {
  instance: DatasourceInstallation
  isDeleting: boolean
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export function IntegrationDeleteDialog({
  instance,
  isDeleting,
  onClose,
  onConfirm,
  open,
}: Props) {
  return (
    <Dialog onOpenChange={(next) => { if (!next) onClose() }} open={open}>
      <DialogContent showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{instance.title}&rdquo;?</DialogTitle>
          <DialogDescription>
            This instance will no longer be available for new searches. Existing room evidence and
            saved result sets keep their historical datasource metadata.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isDeleting} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {isDeleting ? "Deleting…" : "Delete Instance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
