// Peta ORM — 08-collection-paginator
// Collection methods (pluck, groupBy, keyBy, first, last, isEmpty)
// Paginator (paginate, hasMorePages, perPage, total)

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Collection, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255), role: t.string(50) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])

const roles = ["admin", "user", "user", "admin", "user", "user", "admin"]
for (let i = 0; i < roles.length; i++) {
  await User.insert({ name: `User ${i}`, role: roles[i]! })
}

const users = await User.query().orderBy("id", "asc").execute()

// Wrap in Collection
const col = new Collection(users)

// Collection methods
console.log("First:", col.first()?.get("name"))
console.log("Last:", col.last()?.get("name"))
console.log("Pluck names:", col.pluck("name"))
console.log("Grouped by role:", JSON.stringify(Object.keys(col.groupBy("role"))))
console.log("Keyed:", Object.keys(col.keyBy("name")).length, "entries")
console.log("Is empty:", col.isEmpty())
console.log("Names via get():", col.get("name"))

// Paginator
const page1 = await User.query().orderBy("id", "asc").paginate(1, 3)
console.log(`\nPage ${page1.currentPage}/${page1.lastPage}`)
console.log(`Items: ${page1.data.length}, Total: ${page1.total}`)
console.log(`Has more: ${page1.hasMorePages}`)

const page2 = await User.query().orderBy("id", "asc").paginate(3, 3)
console.log(`\nPage ${page2.currentPage}/${page2.lastPage}`)
console.log(`Has more: ${page2.hasMorePages}`)

await peta.destroy()
