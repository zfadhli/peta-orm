// Peta ORM — 03-crud
// insert, find, update, delete, reload, paginate, count

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    email: t.text().email(),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User])

// Insert
const user = await User.insert({ name: "Alice", email: "a@b.com" })
console.log("Inserted:", user.$toJSON())

// Find
const found = await User.find(1)
console.log("Found:", found?.get("name"))

// Update via instance
found!.set("name", "Alice Updated")
await found!.$save()
console.log("Updated:", found!.$toJSON())

// Static update
await User.update(1, { email: "alice@new.com" })

// Reload
await found!.$reload()
console.log("After reload:", found!.$toJSON())

// Delete via instance
const temp = await User.insert({ name: "Temp", email: "t@t.com" })
await temp.$delete()
console.log("Deleted:", (await User.find(temp.get("id") as number)) ?? "not found")

// Paginate
for (let i = 0; i < 10; i++) {
  await User.insert({ name: `User ${i}`, email: `user${i}@x.com` })
}
const page = await User.query().orderBy("id", "asc").paginate(1, 3)
console.log(`Page: ${page.currentPage}/${page.lastPage}, items: ${page.data.length}, hasMore: ${page.hasMorePages}`)
console.log(`First item index: ${page.firstItem}, Last item index: ${page.lastItem}`)

// Count
const total = await User.query().count()
console.log("Total users:", total)

await peta.destroy()
