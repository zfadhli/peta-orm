// Peta ORM — 02-model-definition
// Column types, modifiers (email, min, nullable, default), validation, timestamps

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255).min(2),
    email: t.text().email(),
    age: t.integer().nullable().min(0).max(150).default(0),
    role: t.enum("admin", "user").default("user"),
    score: t.double().nullable(),
    ...t.timestamps(),
  }
}

const database = new Database(":memory:")
database.run(
  "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, age INTEGER DEFAULT 0, role TEXT DEFAULT 'user', score REAL, createdAt TEXT, updatedAt TEXT)",
)

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])
User.registerTimestamps()

const user = await User.insert({
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  role: "admin",
})

console.log("User:", user.$toJSON())
console.log("Defaults:", user.get("role"), user.get("age"))

// Validation catches bad data
try {
  await User.insert({ name: "X", email: "bad" })
} catch (e: any) {
  console.log("Validation error:", e.message)
}

await peta.destroy()
