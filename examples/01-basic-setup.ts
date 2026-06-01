// Peta ORM — 01-basic-setup
// Peta init + SQLite setup + insert/find

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll(User)

const user = await User.insert({ name: "Alice" })
console.log("Created:", user.$toJSON())

const found = await User.find(1)
console.log("Found:", found?.$toJSON())

await peta.destroy()
