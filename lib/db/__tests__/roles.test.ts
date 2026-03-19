import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/index", () => ({
  createSchemaGuard: vi.fn((setup: () => Promise<void>) => {
    let ran = false
    return async () => {
      if (!ran) {
        ran = true
        await setup()
      }
    }
  }),
  dbQuery: vi.fn(),
  generateId: vi.fn((prefix: string) => `${prefix}-test-id`),
  getDbPool: vi.fn(() => true),
}))

import { dbQuery } from "@/lib/db/index"
import {
  createRole,
  deleteRole,
  getPermissionsForRole,
  getRolesForOrg,
  resetPermission,
  setPermission,
} from "@/lib/db/roles"

const mockDbQuery = vi.mocked(dbQuery)

// Helper: cast a SQL-inspector function to the correct mock type
function sqlMock(fn: (sql: string) => Promise<{ rows: unknown[]; rowCount: number }>) {
  return fn as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDbQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never)
})

describe("getRolesForOrg", () => {
  it("returns mapped roles", async () => {
    mockDbQuery.mockImplementation(
      sqlMock(async (sql) => {
        if (sql.includes("SELECT") && sql.includes("org_roles")) {
          return {
            rows: [
              {
                id: "role-1",
                org_id: "org-default",
                name: "org_admin",
                label: "Administrator",
                is_system: true,
                created_at: "2024-01-01T00:00:00Z",
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      }),
    )

    const roles = await getRolesForOrg("org-default")
    expect(roles.length).toBe(1)
    expect(roles[0].name).toBe("org_admin")
    expect(roles[0].label).toBe("Administrator")
    expect(roles[0].isSystem).toBe(true)
  })
})

describe("getPermissionsForRole", () => {
  it("returns defaults when no DB overrides exist", async () => {
    const resolved = await getPermissionsForRole("org-default", "org_admin")

    expect(resolved["admin:manage_roles"]).toBeDefined()
    expect(resolved["admin:manage_roles"].granted).toBe(true)
    expect(resolved["admin:manage_roles"].source).toBe("default")
  })

  it("uses DB override when present", async () => {
    mockDbQuery.mockImplementation(
      sqlMock(async (sql) => {
        if (sql.includes("org_role_permissions") && sql.includes("SELECT")) {
          return {
            rows: [
              {
                id: "rp-1",
                org_id: "org-default",
                role_name: "viewer",
                permission_id: "oracle:view",
                granted: false,
                updated_by: "user-1",
                updated_at: "2024-01-01T00:00:00Z",
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      }),
    )

    const resolved = await getPermissionsForRole("org-default", "viewer")

    expect(resolved["oracle:view"]).toBeDefined()
    expect(resolved["oracle:view"].granted).toBe(false)
    expect(resolved["oracle:view"].source).toBe("db")
  })

  it("viewer has no oracle:contribute by default", async () => {
    const resolved = await getPermissionsForRole("org-default", "viewer")

    expect(resolved["oracle:contribute"].granted).toBe(false)
    expect(resolved["oracle:contribute"].source).toBe("default")
  })

  it("org_admin has integrations:manage by default", async () => {
    const resolved = await getPermissionsForRole("org-default", "org_admin")

    expect(resolved["integrations:manage"].granted).toBe(true)
    expect(resolved["integrations:manage"].source).toBe("default")
  })
})

describe("setPermission", () => {
  it("calls dbQuery with INSERT INTO org_role_permissions", async () => {
    await setPermission("org-default", "viewer", "oracle:view", true, "user-1")

    const insertCall = mockDbQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("INSERT INTO org_role_permissions"),
    )

    expect(insertCall).toBeDefined()
    expect(insertCall?.[1]).toEqual(
      expect.arrayContaining(["org-default", "viewer", "oracle:view", true, "user-1"]),
    )
  })
})

describe("resetPermission", () => {
  it("calls dbQuery with DELETE FROM org_role_permissions", async () => {
    await resetPermission("org-default", "viewer", "oracle:view")

    const deleteCall = mockDbQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("DELETE FROM org_role_permissions"),
    )

    expect(deleteCall).toBeDefined()
    expect(deleteCall?.[1]).toEqual(["org-default", "viewer", "oracle:view"])
  })
})

describe("createRole", () => {
  it("inserts a new role and returns mapped result", async () => {
    mockDbQuery.mockImplementation(
      sqlMock(async (sql) => {
        if (sql.includes("INSERT INTO org_roles")) {
          return {
            rows: [
              {
                id: "role-new-id",
                org_id: "org-default",
                name: "analyst",
                label: "Analyst",
                is_system: false,
                created_at: "2024-01-01T00:00:00Z",
              },
            ],
            rowCount: 1,
          }
        }
        return { rows: [], rowCount: 0 }
      }),
    )

    const role = await createRole("org-default", "analyst", "Analyst")

    expect(role.name).toBe("analyst")
    expect(role.label).toBe("Analyst")
    expect(role.isSystem).toBe(false)
  })
})

describe("deleteRole", () => {
  it("throws when role not found", async () => {
    mockDbQuery.mockImplementation(
      sqlMock(async () => ({ rows: [], rowCount: 0 })),
    )

    await expect(deleteRole("org-default", "nonexistent-id")).rejects.toThrow("Role not found.")
  })

  it("throws when trying to delete a system role", async () => {
    mockDbQuery.mockImplementation(
      sqlMock(async (sql) => {
        if (sql.includes("SELECT is_system FROM org_roles")) {
          return { rows: [{ is_system: true }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    )

    await expect(deleteRole("org-default", "role-system")).rejects.toThrow(
      "System roles cannot be deleted.",
    )
  })

  it("calls DELETE for a non-system role", async () => {
    let deleteCalled = false

    mockDbQuery.mockImplementation(
      sqlMock(async (sql) => {
        if (sql.includes("SELECT is_system FROM org_roles")) {
          return { rows: [{ is_system: false }], rowCount: 1 }
        }
        if (sql.includes("DELETE FROM org_roles")) {
          deleteCalled = true
          return { rows: [], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      }),
    )

    await deleteRole("org-default", "role-custom")
    expect(deleteCalled).toBe(true)
  })
})
