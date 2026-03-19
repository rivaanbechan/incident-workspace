import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
import { PermissionRow } from "../PermissionRow"
import type { PermissionDefinition } from "@/lib/auth/permissionRegistry"

const definition: PermissionDefinition = {
  id: "oracle:contribute",
  label: "Contribute to The Oracle",
  description: "Upload markdown and promote content",
  domain: "oracle",
  axis: "org",
  defaultRoles: ["org_admin"],
  systemManaged: false,
}

const systemDefinition: PermissionDefinition = {
  id: "admin:view",
  label: "Access the admin area",
  description: "View administration pages",
  domain: "admin",
  axis: "org",
  defaultRoles: ["org_admin"],
  systemManaged: true,
}

describe("PermissionRow", () => {
  it("renders label and description", () => {
    render(
      <PermissionRow
        definition={definition}
        entry={{ granted: false, source: "default" }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText("Contribute to The Oracle")).toBeTruthy()
    expect(screen.getByText("Upload markdown and promote content")).toBeTruthy()
  })

  it("shows default badge when source is default", () => {
    render(
      <PermissionRow
        definition={definition}
        entry={{ granted: true, source: "default" }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText("default")).toBeTruthy()
  })

  it("does not show default badge when source is db", () => {
    render(
      <PermissionRow
        definition={definition}
        entry={{ granted: true, source: "db" }}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.queryByText("default")).toBeNull()
  })

  it("calls onToggle when switch is clicked", async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)

    render(
      <PermissionRow
        definition={definition}
        entry={{ granted: false, source: "default" }}
        onToggle={onToggle}
      />,
    )

    const switchEl = screen.getByRole("switch")
    fireEvent.click(switchEl)

    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith("oracle:contribute", true)
    })
  })

  it("shows success toast after toggle", async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)

    render(
      <PermissionRow
        definition={definition}
        entry={{ granted: false, source: "default" }}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole("switch"))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
    })
  })

  it("shows error toast when toggle fails", async () => {
    const onToggle = vi.fn().mockRejectedValue(new Error("API error"))

    render(
      <PermissionRow
        definition={definition}
        entry={{ granted: false, source: "default" }}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(screen.getByRole("switch"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
  })

  it("disables switch for system-managed permissions", () => {
    render(
      <PermissionRow
        definition={systemDefinition}
        entry={{ granted: true, source: "default" }}
        onToggle={vi.fn()}
      />,
    )

    const switchEl = screen.getByRole("switch") as HTMLButtonElement
    expect(switchEl.disabled).toBe(true)
  })
})
