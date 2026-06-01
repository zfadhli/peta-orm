// Peta ORM — 15-batch
// insertMany (batch insert)

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    role: t.string(50).default("user"),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT DEFAULT 'user')")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])

await User.insert({ name: "Alice" })
await User.insert({ name: "Bob" })
await User.insert({ name: "Charlie" })

// insertMany — batch insert
const newUsers = await User.insertMany([
  { name: "Dave", role: "admin" },
  { name: "Eve", role: "admin" },
])
console.log(`Inserted ${newUsers.length} users`)

// Count total
const total = await User.query().count()
console.log(`Total users: ${total}`)

await peta.destroy()
