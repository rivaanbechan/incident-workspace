import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BoardSideRail } from "@/features/incident-workspace/components/board/BoardSideRail"

vi.mock("@/features/incident-workspace/components/board/YourTasksPanel", () => ({
  YourTasksPanel: () => <div data-testid="your-tasks-panel" />,
}))

vi.mock("@/features/incident-workspace/components/board/InvestigationArtifactsPanel", () => ({
  InvestigationArtifactsPanel: () => <div data-testid="artifacts-panel" />,
}))

function makeProps(
  overrides: Partial<Parameters<typeof BoardSideRail>[0]> = {},
): Parameters<typeof BoardSideRail>[0] {
  return {
    actions: [],
    activeRailPanel: "tasks",
    getEntityLabel: vi.fn((id) => id),
    getTimelineEntryLabel: vi.fn((id) => id),
    isBoardFullscreen: false,
    linkedCaseId: null,
    onCreateActionFromArtifact: vi.fn(),
    onLogActionStatusChange: vi.fn(),
    onOpenActionBoard: vi.fn(),
    onOpenTimelineBoard: vi.fn(),
    onSelectEntity: vi.fn(),
    onSetActiveRailPanel: vi.fn(),
    onUpdateAction: vi.fn(),
    roomId: "room-1",
    ...overrides,
  }
}

describe("BoardSideRail", () => {
  it("renders Your Tasks and Findings tab buttons", () => {
    render(<BoardSideRail {...makeProps()} />)
    expect(screen.getByRole("button", { name: /your tasks/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /findings/i })).toBeTruthy()
  })

  it("renders YourTasksPanel when activeRailPanel is tasks", () => {
    render(<BoardSideRail {...makeProps({ activeRailPanel: "tasks" })} />)
    expect(screen.getByTestId("your-tasks-panel")).toBeTruthy()
    expect(screen.queryByTestId("artifacts-panel")).toBeNull()
  })

  it("does NOT render YourTasksPanel when activeRailPanel is findings", () => {
    render(<BoardSideRail {...makeProps({ activeRailPanel: "findings" })} />)
    expect(screen.queryByTestId("your-tasks-panel")).toBeNull()
  })

  it("renders InvestigationArtifactsPanel when activeRailPanel is findings", () => {
    render(<BoardSideRail {...makeProps({ activeRailPanel: "findings" })} />)
    expect(screen.getByTestId("artifacts-panel")).toBeTruthy()
  })

  it("calls onSetActiveRailPanel with findings when clicking the Findings tab", () => {
    const onSetActiveRailPanel = vi.fn()
    render(<BoardSideRail {...makeProps({ onSetActiveRailPanel })} />)
    fireEvent.click(screen.getByRole("button", { name: /findings/i }))
    expect(onSetActiveRailPanel).toHaveBeenCalledTimes(1)
    expect(onSetActiveRailPanel).toHaveBeenCalledWith("findings")
  })

  it("calls onSetActiveRailPanel with tasks when clicking the Your Tasks tab", () => {
    const onSetActiveRailPanel = vi.fn()
    render(<BoardSideRail {...makeProps({ onSetActiveRailPanel, activeRailPanel: "findings" })} />)
    fireEvent.click(screen.getByRole("button", { name: /your tasks/i }))
    expect(onSetActiveRailPanel).toHaveBeenCalledTimes(1)
    expect(onSetActiveRailPanel).toHaveBeenCalledWith("tasks")
  })

  it("applies opacity-0 class when isBoardFullscreen is true", () => {
    render(<BoardSideRail {...makeProps({ isBoardFullscreen: true })} />)
    const aside = document.querySelector("aside")!
    expect(aside.className).toContain("opacity-0")
  })

  it("does NOT apply opacity-0 when isBoardFullscreen is false", () => {
    render(<BoardSideRail {...makeProps({ isBoardFullscreen: false })} />)
    const aside = document.querySelector("aside")!
    expect(aside.className).not.toContain("opacity-0")
  })
})
