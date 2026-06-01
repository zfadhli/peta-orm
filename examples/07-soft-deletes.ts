// Peta ORM — 07-soft-deletes
// $delete, $restore, $forceDelete, $trashed, withTrashed, query scoping

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    deletedAt: t.timestamp().nullable(),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, deletedAt TEXT)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])
User.registerSoftDeletes()

const alice = await User.insert({ name: "Alice" })
const _bob = await User.insert({ name: "Bob" })
const charlie = await User.insert({ name: "Charlie" })

// Soft delete Alice
await alice.$delete()
console.log("Alice trashed:", alice.$trashed())
console.log("Alice exists after delete:", alice.exists)

// By default, queries include non-deleted only
let users = await User.query().orderBy("id", "asc").execute()
console.log(
  "Active users:",
  users.map((u: any) => u.get("name")),
)

// withTrashed includes soft-deleted
const all = await User.query().withTrashed().orderBy("id", "asc").execute()
console.log(
  "All users:",
  all.map((u: any) => u.get("name")),
)

// Restore Alice
await alice.$restore()
console.log("Alice trashed after restore:", alice.$trashed())

// Force delete Charlie
await charlie.$forceDelete()
const found = await User.find(charlie.get("id") as number)
console.log("Charlie after force delete:", found ?? "gone")

await peta.destroy()
