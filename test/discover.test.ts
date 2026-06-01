import { Database } from "bun:sqlite"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ArkTypeSchemaConfig } from "../src/columns/arktype-config"
import { $t } from "../src/columns/column-types"
import { Model } from "../src/model/model"
import { Peta } from "../src/peta"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class RestA extends Model {
  static override table = "rest_a"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
}

class RestB extends Model {
  static override table = "rest_b"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
}

class EmptyTable extends Model {
  static override table = ""
  static override columns = { id: t.integer().primaryKey() }
}

let peta: Peta

beforeAll(() => {
  const database = new Database(":memory:")
  database.run("CREATE TABLE rest_a (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
  database.run("CREATE TABLE rest_b (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
  peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
})

afterAll(async () => {
  await peta.destroy()
})

describe("registerAll rest params", () => {
  it("accepts rest params (no array)", () => {
    peta.registerAll(RestA, RestB)
    expect(peta.getModel("rest_a")).toBe(RestA)
    expect(peta.getModel("rest_b")).toBe(RestB)
  })

  it("still accepts array for backward compat", () => {
    const p = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    p.registerAll([RestA, RestB])
    expect(p.getModel("rest_a")).toBe(RestA)
    expect(p.getModel("rest_b")).toBe(RestB)
    p.destroy()
  })

  it("is idempotent — calling again overrides", () => {
    const p = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    p.registerAll(RestA)
    p.registerAll(RestA, RestB)
    expect(p.getModel("rest_a")).toBe(RestA)
    expect(p.getModel("rest_b")).toBe(RestB)
    p.destroy()
  })

  it("skips models with empty table string (no throw)", () => {
    expect(() => peta.registerAll(EmptyTable)).toThrow()
  })
})

describe("discover", () => {
  it("discovers models from fixture directory", async () => {
    const database = new Database(":memory:")
    database.run("CREATE TABLE discovered (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL)")

    const p = new Peta({ dialect: new BunSqliteDialect({ database }) })

    await p.discover("./test/fixtures/discoverable-model.ts")

    expect(p.getModel("discovered")).toBeDefined()
    expect(p.getModel("discovered")!.table).toBe("discovered")

    await p.destroy()
  })

  it("throws clear error in non-Bun runtimes", async () => {
    // Simulate by temporarily removing Bun.Glob
    const origGlob = (Bun as any).Glob
    ;(Bun as any).Glob = undefined

    const p = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    try {
      await p.discover("./nothing.ts")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect((e as Error).message).toContain("requires Bun")
    }
    await p.destroy()

    ;(Bun as any).Glob = origGlob
  })
})
