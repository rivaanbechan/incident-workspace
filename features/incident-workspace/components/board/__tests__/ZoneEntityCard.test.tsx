import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ZoneEntityCard } from "@/features/incident-workspace/components/board/ZoneEntityCard"
import { ZONE_COLOR_SWATCHES } from "@/features/incident-workspace/components/board/boardShellShared"
import type { InvestigationZoneEntity } from "@/features/incident-workspace/lib/board/types"

const baseEntity: InvestigationZoneEntity = {
  id: "zone-1",
  type: "investigationZone",
  title: "My Zone",
  color: ZONE_COLOR_SWATCHES[0],
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  zIndex: 1,
  createdAt: 1000,
  updatedAt: 1000,
}

const shellStyle = {
  position: "absolute" as const,
  left: 0,
  top: 0,
  width: 200,
  height: 200,
  zIndex: 1,
  boxShadow: "none",
  userSelect: "none" as const,
}

function makeProps(overrides?: Partial<Parameters<typeof ZoneEntityCard>[0]>) {
  return {
    areZonesEditable: true,
    entity: baseEntity,
    handleEntityDoubleClick: vi.fn(),
    handleEntityDragStart: vi.fn(),
    isSelected: false,
    isZoneLocked: false,
    onSelectSingleEntity: vi.fn(),
    resizeHandle: null,
    shellStyle,
    updateEntity: vi.fn(),
    ...overrides,
  }
}

describe("ZoneEntityCard", () => {
  it("renders the entity title in an input when isZoneLocked is false", () => {
    render(<ZoneEntityCard {...makeProps()} />)
    const input = screen.getByDisplayValue("My Zone")
    expect(input.tagName).toBe("INPUT")
  })

  it("renders a badge (not an input) with the title when isZoneLocked is true", () => {
    render(<ZoneEntityCard {...makeProps({ isZoneLocked: true })} />)
    expect(screen.getByText("My Zone")).toBeTruthy()
    expect(screen.queryByDisplayValue("My Zone")).toBeNull()
  })

  it("shows color swatches when not locked (editable)", () => {
    render(<ZoneEntityCard {...makeProps()} />)
    const swatchButtons = ZONE_COLOR_SWATCHES.map((swatch) =>
      document.querySelector(`[style*="${swatch}"]`),
    )
    // At least one swatch button should be present
    expect(swatchButtons.some((btn) => btn !== null)).toBe(true)
  })

  it("calls handleEntityDragStart on pointerdown when not locked", () => {
    const handleEntityDragStart = vi.fn()
    render(<ZoneEntityCard {...makeProps({ handleEntityDragStart })} />)
    const card = document.querySelector("[data-entity-id='zone-1']")!
    fireEvent.pointerDown(card)
    expect(handleEntityDragStart).toHaveBeenCalledTimes(1)
  })

  it("does NOT attach pointerdown handler when locked", () => {
    const handleEntityDragStart = vi.fn()
    render(<ZoneEntityCard {...makeProps({ isZoneLocked: true, handleEntityDragStart })} />)
    const card = document.querySelector("[data-entity-id='zone-1']")!
    fireEvent.pointerDown(card)
    expect(handleEntityDragStart).not.toHaveBeenCalled()
  })

  it("calls updateEntity when title input changes", () => {
    const updateEntity = vi.fn()
    render(<ZoneEntityCard {...makeProps({ updateEntity })} />)
    const input = screen.getByDisplayValue("My Zone")
    fireEvent.change(input, { target: { value: "Updated Zone" } })
    expect(updateEntity).toHaveBeenCalledTimes(1)
    expect(updateEntity).toHaveBeenCalledWith("zone-1", expect.any(Function))
  })
})
