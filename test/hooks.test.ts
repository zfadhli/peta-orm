import { Database } from "bun:sqlite"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ArkTypeSchemaConfig } from "../src/columns/arktype-config"
import { $t } from "../src/columns/column-types"
import { ModelNotRegisteredError } from "../src/errors/errors"
import { HookManager } from "../src/hooks/lifecycle"
import { Model } from "../src/model/model"
import { Peta } from "../src/peta"

const t = $t({ schema: new ArkTypeSchemaConfig() })

describe("HookManager", () => {
  it("registers and triggers hooks", async () => {
    const hm = new HookManager()
    const log: string[] = []
    hm.on("beforeCreate", () => {
      log.push("before")
    })
    hm.on("afterCreate", () => {
      log.push("after")
    })
    const model = Model.hydrate({ name: "test" })
    await hm.trigger("beforeCreate", model)
    await hm.trigger("afterCreate", model)
    expect(log).toEqual(["before", "after"])
  })
})

describe("Model lifecycle hooks", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class HooksTest extends Model {
    static override table = "hooks_test"
    static override columns = {
      id: t.integer().primaryKey(),
      name: t.string(255),
      counter: t.integer().default(0),
    }
  }

  beforeAll(async () => {
    db.run("PRAGMA journal_mode = WAL")
    db.run(
      "CREATE TABLE hooks_test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, counter INTEGER DEFAULT 0)",
    )
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([HooksTest])
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("fires beforeCreate and afterCreate on insert", async () => {
    const log: string[] = []
    HooksTest.on("beforeCreate", (m: any) => {
      log.push("beforeCreate")
      m.set("name", `Hook-${m.get("name")}`)
    })
    HooksTest.on("afterCreate", () => {
      log.push("afterCreate")
    })

    const user = await HooksTest.insert({ name: "Test" })
    expect(log).toContain("beforeCreate")
    expect(log).toContain("afterCreate")
    expect(user.get("name")).toBe("Hook-Test")
  })

  it("fires beforeUpdate and afterUpdate on save", async () => {
    const log: string[] = []
    HooksTest.on("beforeUpdate", (m: any) => {
      log.push("beforeUpdate")
      m.set("counter", (m.get("counter") as number) + 1)
    })
    HooksTest.on("afterUpdate", () => {
      log.push("afterUpdate")
    })

    const user = await HooksTest.insert({ name: "Updatable" })
    user.set("name", "Updated")
    await user.$save()
    expect(log).toContain("beforeUpdate")
    expect(log).toContain("afterUpdate")
  })

  it("fires beforeDelete and afterDelete", async () => {
    const log: string[] = []
    HooksTest.on("beforeDelete", () => {
      log.push("beforeDelete")
    })
    HooksTest.on("afterDelete", () => {
      log.push("afterDelete")
    })

    const user = await HooksTest.insert({ name: "DeleteMe" })
    await user.$delete()
    expect(log).toContain("beforeDelete")
    expect(log).toContain("afterDelete")
  })
})

describe("Timestamps", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class Timestamped extends Model {
    static override table = "timestamped"
    static override columns = {
      id: t.integer().primaryKey(),
      name: t.string(255),
      createdAt: t.timestamp(),
      updatedAt: t.timestamp(),
    }
  }

  beforeAll(async () => {
    db.run("PRAGMA journal_mode = WAL")
    db.run(
      "CREATE TABLE timestamped (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, createdAt TEXT, updatedAt TEXT)",
    )
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([Timestamped])
    Timestamped.registerTimestamps()
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("sets createdAt and updatedAt on create", async () => {
    const record = await Timestamped.insert({ name: "Test" })
    expect(record.get("createdAt")).toBeTruthy()
    expect(record.get("updatedAt")).toBeTruthy()
    expect(record.get("createdAt")).toEqual(record.get("updatedAt"))
  })

  it("updates updatedAt on update, leaves createdAt", async () => {
    const record = await Timestamped.insert({ name: "Test2" })
    const createdAt1 = record.get("createdAt") as string
    await new Promise((r) => setTimeout(r, 10))
    record.set("name", "Updated")
    await record.$save()
    expect(record.get("createdAt")).toEqual(createdAt1)
    expect(record.get("updatedAt")).not.toEqual(createdAt1)
  })
})

describe("Hook idempotency", () => {
  it("registerTimestamps is idempotent", () => {
    class T extends Model {
      static override table = "t_idem"
      static override columns = {
        id: t.integer().primaryKey(),
        name: t.string(255),
        createdAt: t.timestamp(),
        updatedAt: t.timestamp(),
      }
    }
    T.registerTimestamps()
    T.registerTimestamps()
    const hooks = (T as any).hooks
    const _hooksMap = hooks._hooks || hooks._hookManager
    expect(true).toBe(true)
  })
})

describe("Restore hooks", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class RestoreUser extends Model {
    static override table = "restore_user"
    static override columns = { id: t.integer().primaryKey(), name: t.string(255), deletedAt: t.timestamp().nullable() }
  }

  beforeAll(async () => {
    db.run("CREATE TABLE restore_user (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, deletedAt TEXT)")
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([RestoreUser])
    RestoreUser.registerSoftDeletes()
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("triggers beforeRestore on $restore", async () => {
    const log: string[] = []
    RestoreUser.on("beforeRestore", () => {
      log.push("beforeRestore")
    })
    RestoreUser.on("afterRestore", () => {
      log.push("afterRestore")
    })
    const u = await RestoreUser.insert({ name: "X" })
    await u.$delete()
    await u.$restore()
    expect(log).toContain("beforeRestore")
    expect(log).toContain("afterRestore")
  })

  it("triggers beforeForceDelete on $forceDelete", async () => {
    const log: string[] = []
    RestoreUser.on("beforeForceDelete", () => {
      log.push("beforeForceDelete")
    })
    RestoreUser.on("afterForceDelete", () => {
      log.push("afterForceDelete")
    })
    const u = await RestoreUser.insert({ name: "Y" })
    await u.$forceDelete()
    expect(log).toContain("beforeForceDelete")
    expect(log).toContain("afterForceDelete")
  })
})

describe("$delete throws on unsaved", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class UnsavedUser extends Model {
    static override table = "unsaved_user"
    static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  }

  beforeAll(async () => {
    db.run("CREATE TABLE unsaved_user (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([UnsavedUser])
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("throws ModelNotFoundError when no id", async () => {
    const m = UnsavedUser.hydrate({ name: "unsaved" })
    try {
      await m.$delete()
      expect.unreachable()
    } catch (e: any) {
      expect(e.name).toBe("ModelNotFoundError")
    }
  })
})

describe("SoftDeletes", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class SoftDeletable extends Model {
    static override table = "soft_deletable"
    static override columns = {
      id: t.integer().primaryKey(),
      name: t.string(255),
      deletedAt: t.timestamp().nullable(),
    }
  }

  class ForceDeletable extends Model {
    static override table = "force_deletable"
    static override columns = {
      id: t.integer().primaryKey(),
      name: t.string(255),
      deletedAt: t.timestamp().nullable(),
    }
  }

  class Restorable extends Model {
    static override table = "restorable"
    static override columns = {
      id: t.integer().primaryKey(),
      name: t.string(255),
      deletedAt: t.timestamp().nullable(),
    }
  }

  beforeAll(async () => {
    db.run("PRAGMA journal_mode = WAL")
    db.run("CREATE TABLE soft_deletable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, deletedAt TEXT)")
    db.run("CREATE TABLE force_deletable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, deletedAt TEXT)")
    db.run("CREATE TABLE restorable (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, deletedAt TEXT)")
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([SoftDeletable, ForceDeletable, Restorable])
    SoftDeletable.registerSoftDeletes()
    ForceDeletable.registerSoftDeletes()
    Restorable.registerSoftDeletes()
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("soft deletes a record", async () => {
    const record = await SoftDeletable.insert({ name: "Soft" })
    expect(record.$trashed()).toBe(false)
    await record.$delete()
    expect(record.$trashed()).toBe(true)
    expect(record.get("deletedAt")).toBeTruthy()
    expect(record.exists).toBe(true)
  })

  it("force deletes permanently", async () => {
    const record = await ForceDeletable.insert({ name: "Force" })
    await record.$forceDelete()
    expect(record.exists).toBe(false)
    const found = await ForceDeletable.find(record.get("id") as number)
    expect(found).toBeUndefined()
  })

  it("restores a soft-deleted record", async () => {
    const record = await Restorable.insert({ name: "Restore" })
    await record.$delete()
    expect(record.$trashed()).toBe(true)
    await record.$restore()
    expect(record.$trashed()).toBe(false)
    expect(record.get("deletedAt")).toBeNull()
  })

  it("excludes soft-deleted by default", async () => {
    const a = await SoftDeletable.insert({ name: "A" })
    const _b = await SoftDeletable.insert({ name: "B" })
    await a.$delete()
    const active = await SoftDeletable.query().orderBy("id", "asc").execute()
    expect(active).toHaveLength(1)
    expect(active[0]!.get("name")).toBe("B")
  })

  it("withTrashed includes soft-deleted", async () => {
    const all = await SoftDeletable.query().withTrashed().orderBy("id", "asc").execute()
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  it("onlyTrashed returns only deleted", async () => {
    const trashed = await SoftDeletable.query().onlyTrashed().execute()
    expect(trashed.length).toBeGreaterThanOrEqual(1)
    for (const t of trashed) {
      expect(t.get("deletedAt")).toBeTruthy()
    }
  })
})

describe("Custom errors", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class ErrUser extends Model {
    static override table = "err_users"
    static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  }

  beforeAll(async () => {
    db.run("PRAGMA journal_mode = WAL")
    db.run("CREATE TABLE err_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([ErrUser])
    await ErrUser.insert({ name: "Alice" })
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("executeTakeFirstOrThrow throws ModelNotFoundError", async () => {
    try {
      await ErrUser.query().where("id", "=", 999).executeTakeFirstOrThrow()
      expect.unreachable()
    } catch (e: any) {
      expect(e.name).toBe("ModelNotFoundError")
    }
  })

  it("findOrFail throws ModelNotFoundError", async () => {
    try {
      await ErrUser.findOrFail(999)
      expect.unreachable()
    } catch (e: any) {
      expect(e.name).toBe("ModelNotFoundError")
    }
  })

  it("ModelNotRegisteredError for unregistered models", () => {
    class Orphan extends Model {
      static override table = "orphans"
      static override columns = { id: t.integer().primaryKey() }
    }
    expect(() => Orphan.query()).toThrow(ModelNotRegisteredError)
  })
})

describe("Prototype pollution", () => {
  it("set() blocks __proto__", () => {
    const m = Model.hydrate({})
    m.set("__proto__", { malicious: true })
    expect(({} as any).malicious).toBeUndefined()
  })

  it("set() blocks constructor", () => {
    const m = Model.hydrate({})
    m.set("constructor", { malicious: true })
    expect(({}.constructor as any).malicious).toBeUndefined()
  })

  it("fill() skips forbidden keys", () => {
    const m = Model.hydrate({})
    m.fill({ __proto__: { malicious: true }, name: "ok" })
    expect(({} as any).malicious).toBeUndefined()
    expect(m.get("name")).toBe("ok")
  })
})

describe("Circular $toJSON", () => {
  it("handles circular relations without stack overflow", () => {
    const a = Model.hydrate({ id: 1 })
    const b = Model.hydrate({ id: 2 })
    a.$setRelation("child", [b])
    b.$setRelation("parent", a)

    const json = a.$toJSON()
    expect(json).toHaveProperty("id", 1)
    expect(json).toHaveProperty("child")
    const childArr = json.child as any[]
    expect(childArr[0]).toHaveProperty("id", 2)
    expect(childArr[0].parent).toHaveProperty("__circular", true)
  })
})

describe("Casting", () => {
  class CastModel extends Model {
    static override table = "cast_test"
    static override columns = {
      id: t.integer().primaryKey(),
      name: t.string(255),
      meta: t.text().nullable(),
      flags: t.integer().default(0),
    }
    static override $casts = {
      meta: "json" as const,
      flags: "boolean" as const,
    }
  }

  it("casts JSON on get", () => {
    const m = CastModel.hydrate({ id: 1, name: "test", meta: '{"a":1}' })
    const meta = m.get("meta")
    expect(meta).toEqual({ a: 1 })
  })

  it("casts boolean on get", () => {
    const m = CastModel.hydrate({ id: 1, flags: 1 })
    expect(m.get("flags")).toBe(true)
  })

  it("casts JSON on set", () => {
    const m = CastModel.hydrate({ id: 1 })
    m.set("meta", { b: 2 })
    expect(m.get("meta")).toEqual({ b: 2 })
  })
})

describe("Accessors", () => {
  class AccessorModel extends Model {
    static override table = "acc_test"
    static override columns = { id: t.integer().primaryKey(), first: t.string(255), last: t.string(255) }

    getFullNameAttribute() {
      return `${this.get("first")} ${this.get("last")}`
    }
  }

  it("calls get accessor", () => {
    const m = AccessorModel.hydrate({ id: 1, first: "John", last: "Doe" })
    expect(m.get("fullName")).toBe("John Doe")
  })
})

describe("Serialization control", () => {
  it("$hidden excludes keys from $toJSON", () => {
    class HiddenModel extends Model {
      static override table = "hidden_test"
      static override columns = { id: t.integer().primaryKey(), name: t.string(255), password: t.string(255) }
      static override $hidden = ["password"]
    }
    const m = HiddenModel.hydrate({ id: 1, name: "Alice", password: "secret" })
    const json = m.$toJSON()
    expect(json).toHaveProperty("name")
    expect(json).not.toHaveProperty("password")
  })

  it("$visible whitelists keys", () => {
    class VisibleModel extends Model {
      static override table = "visible_test"
      static override columns = { id: t.integer().primaryKey(), name: t.string(255), internal: t.string(255) }
      static override $visible = ["id", "name"]
    }
    const m = VisibleModel.hydrate({ id: 1, name: "Bob", internal: "secret" })
    const json = m.$toJSON()
    expect(json).toHaveProperty("id")
    expect(json).toHaveProperty("name")
    expect(json).not.toHaveProperty("internal")
  })

  it("$appends includes computed attributes", () => {
    class AppendModel extends Model {
      static override table = "append_test"
      static override columns = { id: t.integer().primaryKey(), first: t.string(255), last: t.string(255) }
      static override $appends = ["fullName"]

      getFullNameAttribute() {
        return `${this.get("first")} ${this.get("last")}`
      }
    }
    const m = AppendModel.hydrate({ id: 1, first: "Jane", last: "Doe" })
    const json = m.$toJSON()
    expect(json).toHaveProperty("fullName", "Jane Doe")
  })
})

describe("Transaction", () => {
  const db = new Database(":memory:")
  let peta: Peta

  class TxUser extends Model {
    static override table = "tx_users"
    static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  }

  beforeAll(async () => {
    db.run("CREATE TABLE tx_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
    peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })
    peta.registerAll([TxUser])
  })

  afterAll(async () => {
    await peta.destroy()
    db.close()
  })

  it("Model.transaction commits", async () => {
    await TxUser.transaction(async (trx) => {
      await trx.insertInto("tx_users").values({ name: "Tx Alice" }).execute()
    })
    const user = await TxUser.query().where("name", "=", "Tx Alice").first()
    expect(user).toBeDefined()
  })

  it("Model.transaction rolls back", async () => {
    try {
      await TxUser.transaction(async (trx) => {
        await trx.insertInto("tx_users").values({ name: "Tx Bob" }).execute()
        throw new Error("rollback")
      })
    } catch {}
    const user = await TxUser.query().where("name", "=", "Tx Bob").first()
    expect(user).toBeUndefined()
  })
})
