import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NoteEntityCard } from "@/features/incident-workspace/components/board/NoteEntityCard"
import type { SurfaceTone } from "@/features/incident-workspace/components/board/NoteEntityCard"
import type { NoteEntity } from "@/features/incident-workspace/lib/board/types"

function makeNote(overrides: Partial<NoteEntity> = {}): NoteEntity {
  return {
    id: "note-1",
    type: "note",
    x: 0,
    y: 0,
    width: 280,
    height: 200,
    zIndex: 1,
    title: "Test Note",
    body: "",
    color: "#6366f1",
    mapKind: undefined,
    owner: undefined,
    sourceLabel: undefined,
    state: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

const surfaceTone: SurfaceTone = {
  accent: "#ff0000",
  tint: "#fff0f0",
}

const shellStyle = {
  position: "absolute" as const,
  left: 0,
  top: 0,
  width: 280,
  height: 200,
  zIndex: 1,
  boxShadow: "none",
  userSelect: "none" as const,
}

function makeProps(overrides: Partial<Parameters<typeof NoteEntityCard>[0]> = {}) {
  return {
    entity: makeNote(),
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

describe("NoteEntityCard", () => {
  it("renders entity title in the title input", () => {
    render(<NoteEntityCard {...makeProps()} />)
    const input = screen.getByDisplayValue("Test Note")
    expect(input.tagName).toBe("INPUT")
  })

  it("renders surfaceTone.accent color accent bar at top", () => {
    render(<NoteEntityCard {...makeProps()} />)
    // The accent bar div has `style={{ background: surfaceTone.accent }}`
    // Match the element via the style attribute string (jsdom preserves the raw value)
    const accentBar = document.querySelector(".absolute.inset-x-0.top-0") as HTMLElement | null
    expect(accentBar).not.toBeNull()
    expect(accentBar!.getAttribute("style")).toContain("rgb(255, 0, 0)")
  })

  it("shows hypothesis state and owner fields when mapKind is hypothesis", () => {
    render(
      <NoteEntityCard
        {...makeProps({ entity: makeNote({ mapKind: "hypothesis", state: "new", owner: "" }) })}
      />,
    )
    // Owner placeholder
    expect(screen.getByPlaceholderText("Owner")).toBeTruthy()
    // State select — "New" option rendered into the trigger
    expect(screen.getByText("New")).toBeTruthy()
  })

  it("does NOT show hypothesis fields when mapKind is not hypothesis", () => {
    render(<NoteEntityCard {...makeProps({ entity: makeNote({ mapKind: undefined }) })} />)
    // The hypothesis owner field should not appear when there is no mapKind
    // (There is no Owner placeholder input rendered for non-hypothesis / non-blocker / non-handoff)
    expect(screen.queryByPlaceholderText("Owner")).toBeNull()
  })

  it("shows evidence source input and Open source button when mapKind is evidence and sourceLabel is a valid URL", () => {
    render(
      <NoteEntityCard
        {...makeProps({
          entity: makeNote({ mapKind: "evidence", sourceLabel: "https://example.com" }),
        })}
      />,
    )
    expect(screen.getByPlaceholderText("Source or deep link")).toBeTruthy()
    expect(screen.getByRole("button", { name: /open source/i })).toBeTruthy()
  })

  it("does NOT show Open source button when sourceLabel is not a URL", () => {
    render(
      <NoteEntityCard
        {...makeProps({
          entity: makeNote({ mapKind: "evidence", sourceLabel: "just a label" }),
        })}
      />,
    )
    expect(screen.getByPlaceholderText("Source or deep link")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /open source/i })).toBeNull()
  })

  it("shows owner input when mapKind is blocker", () => {
    render(
      <NoteEntityCard {...makeProps({ entity: makeNote({ mapKind: "blocker", owner: "" }) })} />,
    )
    expect(screen.getByPlaceholderText("Owner")).toBeTruthy()
  })

  it("shows owner input when mapKind is handoff", () => {
    render(
      <NoteEntityCard {...makeProps({ entity: makeNote({ mapKind: "handoff", owner: "" }) })} />,
    )
    expect(screen.getByPlaceholderText("Owner")).toBeTruthy()
  })

  it("calls updateEntity when title changes", () => {
    const updateEntity = vi.fn()
    render(<NoteEntityCard {...makeProps({ updateEntity })} />)
    const input = screen.getByDisplayValue("Test Note")
    fireEvent.change(input, { target: { value: "Updated Note" } })
    expect(updateEntity).toHaveBeenCalledTimes(1)
    expect(updateEntity).toHaveBeenCalledWith("note-1", expect.any(Function))
  })

  it("calls onConnectToEntity via onPointerDownCapture when pendingConnectionSourceId is set to a different entity id", () => {
    const onConnectToEntity = vi.fn()
    render(
      <NoteEntityCard
        {...makeProps({ onConnectToEntity, pendingConnectionSourceId: "other-entity" })}
      />,
    )
    const card = document.querySelector("[data-entity-id='note-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).toHaveBeenCalledTimes(1)
    expect(onConnectToEntity).toHaveBeenCalledWith("note-1")
  })

  it("does NOT call onConnectToEntity when pendingConnectionSourceId is null", () => {
    const onConnectToEntity = vi.fn()
    render(
      <NoteEntityCard
        {...makeProps({ onConnectToEntity, pendingConnectionSourceId: null })}
      />,
    )
    const card = document.querySelector("[data-entity-id='note-1']")!
    fireEvent.pointerDown(card)
    expect(onConnectToEntity).not.toHaveBeenCalled()
  })
})
