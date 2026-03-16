import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { IncidentEntityCard } from "@/features/incident-workspace/components/board/IncidentEntityCard"
import type { SurfaceTone } from "@/features/incident-workspace/components/board/NoteEntityCard"
import type { IncidentCardEntity } from "@/features/incident-workspace/lib/board/types"

function makeIncident(overrides: Partial<IncidentCardEntity> = {}): IncidentCardEntity {
  return {
    id: "incident-1",
    type: "incidentCard",
    x: 0,
    y: 0,
    width: 320,
    height: 280,
    zIndex: 1,
    title: "Test Incident",
    body: "",
    severity: "medium",
    status: "open",
    mapKind: undefined,
    owner: undefined,
    scopeType: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

const surfaceTone: SurfaceTone = {
  accent: "#3b82f6",
  tint: "#eff6ff",
}

const shellStyle = {
  position: "absolute" as const,
  left: 0,
  top: 0,
  width: 320,
  height: 280,
  zIndex: 1,
  boxShadow: "none",
  userSelect: "none" as const,
}

function makeProps(overrides: Partial<Parameters<typeof IncidentEntityCard>[0]> = {}) {
  return {
    entity: makeIncident(),
    handleEntityDoubleClick: vi.fn(),
    handleEntityDragStart: vi.fn(),
    metaBadges: null,
    onConnectToEntity: vi.fn(),
    onSelectSingleEntity: vi.fn(),
    pendingConnectionSourceId: null,
    resizeHandle: null,
    shellStyle,
    surfaceTone,
    updateEntity: vi.fn(),
    ...overrides,
  }
}

describe("IncidentEntityCard", () => {
  it("renders entity title in input", () => {
    render(<IncidentEntityCard {...makeProps()} />)
    const input = screen.getByDisplayValue("Test Incident")
    expect(input.tagName).toBe("INPUT")
  })

  it("renders severity select with current severity value", () => {
    render(<IncidentEntityCard {...makeProps({ entity: makeIncident({ severity: "high" }) })} />)
    // The SelectValue renders the current value as visible text in the trigger
    expect(screen.getByText("High")).toBeTruthy()
  })

  it("renders status select with current status value", () => {
    render(
      <IncidentEntityCard
        {...makeProps({ entity: makeIncident({ status: "monitoring" }) })}
      />,
    )
    expect(screen.getByText("Monitoring")).toBeTruthy()
  })

  it("shows scope type select when mapKind is scope", () => {
    render(
      <IncidentEntityCard
        {...makeProps({ entity: makeIncident({ mapKind: "scope", scopeType: "service" }) })}
      />,
    )
    expect(screen.getByText("Service")).toBeTruthy()
  })

  it("does NOT show scope type select when mapKind is not scope", () => {
    render(<IncidentEntityCard {...makeProps({ entity: makeIncident({ mapKind: undefined }) })} />)
    // The scope-specific items (Host, Identity, Tenant, Detection) only render when mapKind=scope
    expect(screen.queryByText("Service")).toBeNull()
    expect(screen.queryByText("Host")).toBeNull()
  })

  it("shows the accent bar at top", () => {
    render(<IncidentEntityCard {...makeProps()} />)
    // The accent bar div has `style={{ background: surfaceTone.accent }}`
    // Match via class and check the raw style attribute
    const accentBar = document.querySelector(".absolute.inset-x-0.top-0") as HTMLElement | null
    expect(accentBar).not.toBeNull()
    expect(accentBar!.getAttribute("style")).toContain("rgb(59, 130, 246)")
  })

  it("calls updateEntity when title input changes", () => {
    const updateEntity = vi.fn()
    render(<IncidentEntityCard {...makeProps({ updateEntity })} />)
    const input = screen.getByDisplayValue("Test Incident")
    fireEvent.change(input, { target: { value: "Updated Incident" } })
    expect(updateEntity).toHaveBeenCalledTimes(1)
    expect(updateEntity).toHaveBeenCalledWith("incident-1", expect.any(Function))
  })

  it("calls onConnectToEntity via onPointerDownCapture when pendingConnectionSourceId differs from entity.id", () => {
    const onConnectToEntity = vi.fn()
    render(
      <IncidentEntityCard
        {...makeProps({ onConnectToEntity, pendingConnectionSourceId: "other-entity" })}
      />,
    )
    const card = document.querySelector("[data-entity-id='incident-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).toHaveBeenCalledTimes(1)
    expect(onConnectToEntity).toHaveBeenCalledWith("incident-1")
  })

  it("does NOT call onConnectToEntity when pendingConnectionSourceId is null", () => {
    const onConnectToEntity = vi.fn()
    render(
      <IncidentEntityCard {...makeProps({ onConnectToEntity, pendingConnectionSourceId: null })} />,
    )
    const card = document.querySelector("[data-entity-id='incident-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).not.toHaveBeenCalled()
  })
})
