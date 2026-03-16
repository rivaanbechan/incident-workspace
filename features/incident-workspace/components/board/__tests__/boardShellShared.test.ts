import { describe, it, expect } from "vitest"
import {
  getEntityMapKind,
  isCasePromotableEntity,
  isEditingElement,
} from "@/features/incident-workspace/components/board/boardShellShared"
import type { BoardEntity } from "@/features/incident-workspace/lib/board/types"

describe("isEditingElement", () => {
  const makeElement = (tagName: string, isContentEditable = false) => ({
    tagName,
    isContentEditable,
  })

  it("returns true for INPUT", () => {
    expect(isEditingElement(makeElement("INPUT") as unknown as EventTarget)).toBe(true)
  })

  it("returns true for TEXTAREA", () => {
    expect(isEditingElement(makeElement("TEXTAREA") as unknown as EventTarget)).toBe(true)
  })

  it("returns true for SELECT", () => {
    expect(isEditingElement(makeElement("SELECT") as unknown as EventTarget)).toBe(true)
  })

  it("returns true for contentEditable elements", () => {
    expect(isEditingElement(makeElement("DIV", true) as unknown as EventTarget)).toBe(true)
  })

  it("returns false for regular DIV elements", () => {
    expect(isEditingElement(makeElement("DIV") as unknown as EventTarget)).toBe(false)
  })

  it("returns false for null", () => {
    expect(isEditingElement(null)).toBe(false)
  })
})

describe("getEntityMapKind", () => {
  it("returns null for null entity", () => {
    expect(getEntityMapKind(null)).toBeNull()
  })

  it("returns null for a note entity without mapKind", () => {
    const entity = { type: "note" } as unknown as BoardEntity

    expect(getEntityMapKind(entity)).toBeNull()
  })

  it("returns the mapKind for a note entity with mapKind", () => {
    const entity = { type: "note", mapKind: "hypothesis" } as unknown as BoardEntity

    expect(getEntityMapKind(entity)).toBe("hypothesis")
  })

  it("returns 'scope' for an incidentCard with mapKind 'scope'", () => {
    const entity = {
      type: "incidentCard",
      mapKind: "scope",
    } as unknown as BoardEntity

    expect(getEntityMapKind(entity)).toBe("scope")
  })

  it("returns null for an incidentCard without mapKind 'scope'", () => {
    const entity = { type: "incidentCard" } as unknown as BoardEntity

    expect(getEntityMapKind(entity)).toBeNull()
  })

  it("returns null for investigationZone entities", () => {
    const entity = { type: "investigationZone" } as unknown as BoardEntity

    expect(getEntityMapKind(entity)).toBeNull()
  })
})

describe("isCasePromotableEntity", () => {
  it("returns true for incidentCard entities", () => {
    const entity = { type: "incidentCard" } as unknown as BoardEntity

    expect(isCasePromotableEntity(entity)).toBe(true)
  })

  it("returns true for note entities", () => {
    const entity = { type: "note" } as unknown as BoardEntity

    expect(isCasePromotableEntity(entity)).toBe(true)
  })

  it("returns false for investigationZone entities", () => {
    const entity = { type: "investigationZone" } as unknown as BoardEntity

    expect(isCasePromotableEntity(entity)).toBe(false)
  })

  it("returns false for statusMarker entities", () => {
    const entity = { type: "statusMarker" } as unknown as BoardEntity

    expect(isCasePromotableEntity(entity)).toBe(false)
  })

  it("returns false for null", () => {
    expect(isCasePromotableEntity(null)).toBe(false)
  })
})
