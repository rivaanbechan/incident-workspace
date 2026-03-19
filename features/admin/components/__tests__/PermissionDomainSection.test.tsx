import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { PermissionDomainSection } from "../PermissionDomainSection"
import type { PermissionDefinition } from "@/lib/auth/permissionRegistry"
import type { ResolvedRolePermissions } from "@/lib/db/roles"

const definitions: PermissionDefinition[] = [
  {
    id: "oracle:view",
    label: "Browse Oracle entries",
    description: "Search the knowledge base",
    domain: "oracle",
    axis: "org",
    defaultRoles: ["org_admin", "investigator"],
    systemManaged: false,
  },
  {
    id: "oracle:contribute",
    label: "Contribute to The Oracle",
    description: "Upload markdown",
    domain: "oracle",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: false,
  },
]

const permissions: ResolvedRolePermissions = {
  "oracle:view": { granted: true, source: "default" },
  "oracle:contribute": { granted: false, source: "default" },
}

describe("PermissionDomainSection", () => {
  it("renders domain label", () => {
    render(
      <PermissionDomainSection
        domain="oracle"
        definitions={definitions}
        permissions={permissions}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText("The Oracle")).toBeTruthy()
  })

  it("renders all permission rows when expanded", () => {
    render(
      <PermissionDomainSection
        domain="oracle"
        definitions={definitions}
        permissions={permissions}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText("Browse Oracle entries")).toBeTruthy()
    expect(screen.getByText("Contribute to The Oracle")).toBeTruthy()
  })

  it("collapses when header is clicked", () => {
    render(
      <PermissionDomainSection
        domain="oracle"
        definitions={definitions}
        permissions={permissions}
        onToggle={vi.fn()}
      />,
    )

    const header = screen.getByRole("button")
    fireEvent.click(header)

    expect(screen.queryByText("Browse Oracle entries")).toBeNull()
  })

  it("re-expands when header is clicked again", () => {
    render(
      <PermissionDomainSection
        domain="oracle"
        definitions={definitions}
        permissions={permissions}
        onToggle={vi.fn()}
      />,
    )

    const header = screen.getByRole("button")
    fireEvent.click(header)
    fireEvent.click(header)

    expect(screen.getByText("Browse Oracle entries")).toBeTruthy()
  })

  it("renders nothing when definitions is empty", () => {
    const { container } = render(
      <PermissionDomainSection
        domain="oracle"
        definitions={[]}
        permissions={permissions}
        onToggle={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
