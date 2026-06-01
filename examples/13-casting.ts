// Peta ORM — 13-casting
// $casts (json, boolean), $hidden, $appends, accessors

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    first: t.string(255).default(""),
    last: t.string(255).default(""),
    meta: t.text().nullable(),
    flags: t.integer().default(0),
    password: t.string(255).default(""),
  }

  static override $casts = {
    meta: "json",
    flags: "boolean",
  }

  static override $hidden = ["password"]

  static override $appends = ["fullName"]

  getFullNameAttribute(): string {
    return `${this.get("first")} ${this.get("last")}`.trim()
  }
}

const database = new Database(":memory:")
database.run(
  "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, first TEXT DEFAULT '', last TEXT DEFAULT '', meta TEXT, flags INTEGER DEFAULT 0, password TEXT DEFAULT '')",
)

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])

// Attribute casting — JSON auto-parse/serialize
const user = await User.insert({
  name: "Alice",
  meta: JSON.stringify({ theme: "dark" }),
  flags: 1,
  password: "secret123",
})
console.log("Meta (parsed from JSON):", user.get("meta")) // { theme: "dark" }
console.log("Flags (as boolean):", user.get("flags")) // true

// $hidden — password excluded from serialization
console.log("JSON (password hidden):", Object.keys(user.$toJSON())) // no "password"

// $appends — computed attribute included in serialization
user.set("first", "Alice")
user.set("last", "Smith")
console.log("Appended fullName:", user.$toJSON().fullName) // "Alice Smith"

await peta.destroy()
