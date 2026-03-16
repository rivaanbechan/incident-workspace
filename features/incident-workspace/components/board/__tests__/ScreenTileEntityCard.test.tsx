import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ScreenTileEntityCard } from "@/features/incident-workspace/components/board/ScreenTileEntityCard"
import type { ScreenTileEntity } from "@/features/incident-workspace/lib/board/types"

const baseEntity: ScreenTileEntity = {
  id: "tile-1",
  type: "screenTile",
  title: "Screen Share",
  status: "placeholder",
  participantId: null,
  trackId: null,
  x: 0,
  y: 0,
  width: 400,
  height: 300,
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

function makeProps(overrides?: Partial<Parameters<typeof ScreenTileEntityCard>[0]>) {
  return {
    entity: baseEntity,
    handleEntityDoubleClick: vi.fn(),
    handleEntityDragStart: vi.fn(),
    onConnectToEntity: vi.fn(),
    onSelectSingleEntity: vi.fn(),
    pendingConnectionSourceId: null,
    resizeHandle: null,
    shellStyle,
    updateEntity: vi.fn(),
    ...overrides,
  }
}

describe("ScreenTileEntityCard", () => {
  it("renders entity title in an input", () => {
    render(<ScreenTileEntityCard {...makeProps()} />)
    const input = screen.getByDisplayValue("Screen Share")
    expect(input.tagName).toBe("INPUT")
  })

  it("shows 'Live screen share connected.' when entity.status is 'active'", () => {
    render(
      <ScreenTileEntityCard
        {...makeProps({ entity: { ...baseEntity, status: "active" } })}
      />,
    )
    expect(screen.getByText("Live screen share connected.")).toBeTruthy()
  })

  it("shows 'Waiting for a shared screen.' when entity.status is not 'active'", () => {
    render(<ScreenTileEntityCard {...makeProps()} />)
    expect(screen.getByText("Waiting for a shared screen.")).toBeTruthy()
  })

  it("applies active blue border color when entity.status is 'active'", () => {
    render(
      <ScreenTileEntityCard
        {...makeProps({ entity: { ...baseEntity, status: "active" } })}
      />,
    )
    const card = document.querySelector("[data-entity-id='tile-1']") as HTMLElement
    // jsdom normalizes hex colors to rgb
    expect(card.style.borderColor).toBe("rgb(37, 99, 235)")
  })

  it("does NOT apply blue border color when entity.status is 'placeholder'", () => {
    render(<ScreenTileEntityCard {...makeProps()} />)
    const card = document.querySelector("[data-entity-id='tile-1']") as HTMLElement
    expect(card.style.borderColor).not.toBe("#2563eb")
  })

  it("calls onConnectToEntity via onPointerDownCapture when pendingConnectionSourceId is set and differs from entity.id", () => {
    const onConnectToEntity = vi.fn()
    render(
      <ScreenTileEntityCard
        {...makeProps({ onConnectToEntity, pendingConnectionSourceId: "other-entity-id" })}
      />,
    )
    const card = document.querySelector("[data-entity-id='tile-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).toHaveBeenCalledTimes(1)
    expect(onConnectToEntity).toHaveBeenCalledWith("tile-1")
  })

  it("does NOT call onConnectToEntity when pendingConnectionSourceId equals entity.id", () => {
    const onConnectToEntity = vi.fn()
    render(
      <ScreenTileEntityCard
        {...makeProps({ onConnectToEntity, pendingConnectionSourceId: "tile-1" })}
      />,
    )
    const card = document.querySelector("[data-entity-id='tile-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).not.toHaveBeenCalled()
  })

  it("does NOT call onConnectToEntity when pendingConnectionSourceId is null", () => {
    const onConnectToEntity = vi.fn()
    render(
      <ScreenTileEntityCard
        {...makeProps({ onConnectToEntity, pendingConnectionSourceId: null })}
      />,
    )
    const card = document.querySelector("[data-entity-id='tile-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).not.toHaveBeenCalled()
  })
})
