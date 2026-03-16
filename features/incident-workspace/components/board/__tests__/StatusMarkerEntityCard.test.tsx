import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { StatusMarkerEntityCard } from "@/features/incident-workspace/components/board/StatusMarkerEntityCard"
import type { StatusMarkerEntity } from "@/features/incident-workspace/lib/board/types"

const baseEntity: StatusMarkerEntity = {
  id: "marker-1",
  type: "statusMarker",
  label: "Database down",
  tone: "danger",
  x: 0,
  y: 0,
  width: 300,
  height: 52,
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

function makeProps(overrides?: Partial<Parameters<typeof StatusMarkerEntityCard>[0]>) {
  return {
    entity: baseEntity,
    handleEntityDoubleClick: vi.fn(),
    handleEntityDragStart: vi.fn(),
    shellStyle,
    ...overrides,
  }
}

describe("StatusMarkerEntityCard", () => {
  it("renders entity.label", () => {
    render(<StatusMarkerEntityCard {...makeProps()} />)
    expect(screen.getByText("Database down")).toBeTruthy()
  })

  it("renders a badge with entity.tone text", () => {
    render(<StatusMarkerEntityCard {...makeProps()} />)
    expect(screen.getByText("danger")).toBeTruthy()
  })

  it("renders the correct tone badge text for each tone", () => {
    const tones: StatusMarkerEntity["tone"][] = ["neutral", "warn", "danger", "success"]
    for (const tone of tones) {
      const { unmount } = render(
        <StatusMarkerEntityCard {...makeProps({ entity: { ...baseEntity, tone } })} />,
      )
      expect(screen.getByText(tone)).toBeTruthy()
      unmount()
    }
  })

  it("applies the correct tone CSS class for 'danger'", () => {
    render(<StatusMarkerEntityCard {...makeProps()} />)
    const card = document.querySelector("[data-entity-id='marker-1']")!
    expect(card.className).toContain("border-destructive/20")
  })

  it("applies the correct tone CSS class for 'success'", () => {
    render(
      <StatusMarkerEntityCard
        {...makeProps({ entity: { ...baseEntity, tone: "success" } })}
      />,
    )
    const card = document.querySelector("[data-entity-id='marker-1']")!
    expect(card.className).toContain("border-success/20")
  })

  it("applies the correct tone CSS class for 'warn'", () => {
    render(
      <StatusMarkerEntityCard
        {...makeProps({ entity: { ...baseEntity, tone: "warn" } })}
      />,
    )
    const card = document.querySelector("[data-entity-id='marker-1']")!
    expect(card.className).toContain("border-warning/20")
  })

  it("applies the correct tone CSS class for 'neutral'", () => {
    render(
      <StatusMarkerEntityCard
        {...makeProps({ entity: { ...baseEntity, tone: "neutral" } })}
      />,
    )
    const card = document.querySelector("[data-entity-id='marker-1']")!
    expect(card.className).toContain("border-border")
  })

  it("calls handleEntityDoubleClick on double click", () => {
    const handleEntityDoubleClick = vi.fn()
    render(<StatusMarkerEntityCard {...makeProps({ handleEntityDoubleClick })} />)
    const card = document.querySelector("[data-entity-id='marker-1']")!
    fireEvent.doubleClick(card)
    expect(handleEntityDoubleClick).toHaveBeenCalledTimes(1)
  })

  it("calls handleEntityDragStart on pointer down", () => {
    const handleEntityDragStart = vi.fn()
    render(<StatusMarkerEntityCard {...makeProps({ handleEntityDragStart })} />)
    const card = document.querySelector("[data-entity-id='marker-1']")!
    fireEvent.pointerDown(card)
    expect(handleEntityDragStart).toHaveBeenCalledTimes(1)
  })
})
