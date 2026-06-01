// Peta ORM — 14-global-scopes
// addGlobalScope(), withoutGlobalScope()

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    active: t.integer().default(1),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, active INTEGER DEFAULT 1)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])

// Register a global scope — applied automatically to all queries
User.addGlobalScope("active", (qb) => qb.where("active", "=", 1))

await User.insert({ name: "Alice", active: 1 })
await User.insert({ name: "Bob", active: 0 })
await User.insert({ name: "Charlie", active: 1 })

// Global scope filters out inactive users automatically
const active = await User.query().orderBy("id", "asc").execute()
console.log(
  "Active users (scope applied):",
  active.map((u: any) => u.get("name")),
)
// → ["Alice", "Charlie"]

// Bypass global scope with withoutGlobalScope()
const all = await User.query().withoutGlobalScope("active").orderBy("id", "asc").execute()
console.log(
  "All users (scope bypassed):",
  all.map((u: any) => u.get("name")),
)
// → ["Alice", "Bob", "Charlie"]

await peta.destroy()
