// Peta ORM — 06-hooks-timestamps
// beforeCreate, afterCreate, registerTimestamps, custom hooks that modify data

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    ...t.timestamps(),
  }
}

const database = new Database(":memory:")
database.run(
  "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, createdAt TEXT, updatedAt TEXT)",
)

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])

// Register timestamp hooks
User.registerTimestamps()

// Insert auto-sets createdAt + updatedAt
const user = await User.insert({ name: "Alice" })
console.log("Created at:", user.get("createdAt"))
console.log("Updated at:", user.get("updatedAt"))

// Wait a tick then update
await new Promise((r) => setTimeout(r, 10))
user.set("name", "Alice Updated")
await user.$save()
console.log("Updated at changed:", user.get("updatedAt"))
console.log("Created at same:", user.get("createdAt"))

// Custom hook: log all creates
User.on("afterCreate", (model) => {
  console.log(`[AUDIT] User created: ${model.get("name")} at ${model.get("createdAt")}`)
})

await User.insert({ name: "Bob" })

// Hook that modifies data before save
User.on("beforeCreate", (model) => {
  const name = model.get("name") as string
  model.set("name", name.trim())
})

await User.insert({ name: "  Charlie  " })
console.log("Trimmed name:", (await User.find(3))?.get("name"))

await peta.destroy()
