import { Database } from "bun:sqlite"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ArkTypeSchemaConfig } from "../src/columns/arktype-config"
import { $t } from "../src/columns/column-types"
import { DatabaseError, ModelNotFoundError } from "../src/errors/errors"
import { Model } from "../src/model/model"
import { Peta } from "../src/peta"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class UniqueUser extends Model {
  static override table = "unique_users"
  static override columns = {
    id: t.integer().primaryKey(),
    slug: t.string(255),
  }
}

let peta: Peta

beforeAll(async () => {
  const database = new Database(":memory:")
  database.run("PRAGMA journal_mode = WAL")
  database.run("CREATE TABLE unique_users (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE)")
  peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
  peta.registerAll([UniqueUser])
  await UniqueUser.insert({ slug: "taken" })
})

afterAll(async () => {
  await peta.destroy()
})

describe("DatabaseError", () => {
  it("throws DatabaseError on unique constraint violation (insert)", async () => {
    try {
      await UniqueUser.insert({ slug: "taken" })
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(DatabaseError)
      expect((e as DatabaseError).code).toBe("UNIQUE_CONSTRAINT")
      expect((e as DatabaseError).table).toBe("unique_users")
    }
  })

  it("throws DatabaseError on unique constraint violation (insertMany)", async () => {
    try {
      await UniqueUser.insertMany([{ slug: "taken" }, { slug: "unique" }])
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(DatabaseError)
      expect((e as DatabaseError).code).toBe("UNIQUE_CONSTRAINT")
    }
  })

  it("throws ModelNotFoundError, not DatabaseError, on missing record (update)", async () => {
    try {
      await UniqueUser.update(999, { slug: "whatever" })
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(ModelNotFoundError)
    }
  })

  it("wraps with table name in the error", async () => {
    try {
      await UniqueUser.insert({ slug: "taken" })
    } catch (e) {
      expect((e as DatabaseError).table).toBe("unique_users")
    }
  })

  it("has a descriptive message", async () => {
    try {
      await UniqueUser.insert({ slug: "taken" })
    } catch (e) {
      expect((e as DatabaseError).message).toContain("Unique constraint")
    }
  })
})
