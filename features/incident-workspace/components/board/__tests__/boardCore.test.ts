import { describe, it, expect } from "vitest"
import {
  clamp,
  createIncidentCard,
  createInvestigationZone,
  createNote,
  nextBackgroundZIndex,
  screenToBoard,
} from "@/features/incident-workspace/components/board/boardCore"
import type { BoardEntity, CameraState } from "@/features/incident-workspace/lib/board/types"

const makeEntity = (zIndex: number): BoardEntity =>
  ({
    ...createNote({ x: 0, y: 0 }, zIndex),
  }) as BoardEntity

describe("createNote", () => {
  it("creates a note with the given position and zIndex", () => {
    const note = createNote({ x: 100, y: 200 }, 3)

    expect(note.type).toBe("note")
    expect(note.x).toBe(100)
    expect(note.y).toBe(200)
    expect(note.zIndex).toBe(3)
  })

  it("creates a note with a non-empty id prefixed with 'note'", () => {
    const note = createNote({ x: 0, y: 0 }, 1)

    expect(note.id).toMatch(/^note-/)
  })

  it("creates a note with a default title and body", () => {
    const note = createNote({ x: 0, y: 0 }, 1)

    expect(note.title).toBe("New note")
    expect(typeof note.body).toBe("string")
    expect(note.body.length).toBeGreaterThan(0)
  })

  it("uses a color from the NOTE_COLORS palette", () => {
    const note = createNote({ x: 0, y: 0 }, 0)

    expect(typeof note.color).toBe("string")
    expect(note.color.length).toBeGreaterThan(0)
  })
})

describe("createIncidentCard", () => {
  it("creates an incident card with the given position and zIndex", () => {
    const card = createIncidentCard({ x: 50, y: 75 }, 2)

    expect(card.type).toBe("incidentCard")
    expect(card.x).toBe(50)
    expect(card.y).toBe(75)
    expect(card.zIndex).toBe(2)
  })

  it("creates an incident card with default severity 'high' and status 'open'", () => {
    const card = createIncidentCard({ x: 0, y: 0 }, 1)

    expect(card.severity).toBe("high")
    expect(card.status).toBe("open")
  })

  it("creates an incident card with a prefixed id", () => {
    const card = createIncidentCard({ x: 0, y: 0 }, 1)

    expect(card.id).toMatch(/^incident-/)
  })
})

describe("createInvestigationZone", () => {
  it("creates an investigation zone with the given position and zIndex", () => {
    const zone = createInvestigationZone({ x: 10, y: 20 }, 5)

    expect(zone.type).toBe("investigationZone")
    expect(zone.x).toBe(10)
    expect(zone.y).toBe(20)
    expect(zone.zIndex).toBe(5)
  })

  it("creates an investigation zone with a prefixed id", () => {
    const zone = createInvestigationZone({ x: 0, y: 0 }, 1)

    expect(zone.id).toMatch(/^zone-/)
  })

  it("uses a color from the ZONE_COLORS palette", () => {
    const zone = createInvestigationZone({ x: 0, y: 0 }, 0)

    expect(typeof zone.color).toBe("string")
    expect(zone.color).toMatch(/rgba/)
  })
})

describe("screenToBoard", () => {
  const rect = {
    left: 100,
    top: 50,
    width: 800,
    height: 600,
    right: 900,
    bottom: 650,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  } as DOMRect

  it("converts screen coordinates to board coordinates at zoom 1 with no offset", () => {
    const camera: CameraState = { x: 0, y: 0, zoom: 1 }
    const result = screenToBoard(200, 150, rect, camera)

    expect(result.x).toBe(100) // (200 - 100 - 0) / 1
    expect(result.y).toBe(100) // (150 - 50 - 0) / 1
  })

  it("applies camera offset correctly", () => {
    const camera: CameraState = { x: 50, y: 25, zoom: 1 }
    const result = screenToBoard(200, 150, rect, camera)

    expect(result.x).toBe(50) // (200 - 100 - 50) / 1
    expect(result.y).toBe(75) // (150 - 50 - 25) / 1
  })

  it("applies zoom correctly", () => {
    const camera: CameraState = { x: 0, y: 0, zoom: 2 }
    const result = screenToBoard(300, 150, rect, camera)

    expect(result.x).toBe(100) // (300 - 100 - 0) / 2
    expect(result.y).toBe(50) // (150 - 50 - 0) / 2
  })
})

describe("nextBackgroundZIndex", () => {
  it("returns -1 for an empty entity list", () => {
    expect(nextBackgroundZIndex([])).toBe(-1)
  })

  it("returns the minimum zIndex minus 1", () => {
    const entities = [makeEntity(2), makeEntity(-3), makeEntity(5)]

    expect(nextBackgroundZIndex(entities)).toBe(-4)
  })

  it("handles a single entity", () => {
    const entities = [makeEntity(0)]

    expect(nextBackgroundZIndex(entities)).toBe(-1)
  })
})

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it("clamps to min when value is below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it("clamps to max when value is above range", () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it("returns min when value equals min", () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it("returns max when value equals max", () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })
})
