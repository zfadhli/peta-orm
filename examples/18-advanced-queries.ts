// Peta ORM — 18-advanced-queries
// Query builder: executeTakeFirstOrThrow, whereRef, groupBy/having,
//   sum/avg/min/max, chunk, toSQL, clone, updateMany/deleteMany, select/selectAll

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Product extends Model {
  static override table = "products"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255), price: t.double(), category: t.string(50) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL, category TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll(Product)

for (const [name, price, category] of [
  ["Widget", 10.0, "tools"],
  ["Gadget", 25.0, "tools"],
  ["Book", 15.0, "media"],
  ["Magazine", 8.0, "media"],
  ["Movie", 20.0, "media"],
] as [string, number, string][]) {
  await Product.insert({ name, price, category })
}

// === select / selectAll ===
const names = await Product.query().select("name").orderBy("id", "asc").execute()
console.log("select names:", names.map((p) => p.get("name")))

// === executeTakeFirstOrThrow ===
const first = await Product.query().where("id", "=", 1).executeTakeFirstOrThrow()
console.log("executeTakeFirstOrThrow:", first.get("name"))

// === whereRef === using direct SQL reference to compare columns
console.log("whereRef: (not shown — requires same-table column comparison)")

// === groupBy / having ===
const categories = await Product.query().groupBy("category").execute()
console.log("groupBy categories:", categories.map((c) => c.get("category")))

const expensiveCategories = await Product.query()
  .groupBy("category")
  .having("category", "=", "tools")
  .execute()
console.log("having category=tools:", expensiveCategories.length, "rows")

// === Aggregates: sum / avg / min / max ===
console.log("sum price:", await Product.query().sum("price"))
console.log("avg price:", await Product.query().avg("price"))
console.log("min price:", await Product.query().min("price"))
console.log("max price:", await Product.query().max("price"))

// === chunk ===
let chunkCount = 0
await Product.query().orderBy("id", "asc").chunk(2, async (chunk) => {
  chunkCount++
  console.log(`chunk ${chunkCount}:`, chunk.map((p) => p.get("name")))
})

// === toSQL ===
const sql = Product.query().where("category", "=", "tools").orderBy("name", "asc").toSQL()
console.log("toSQL:", sql.sql, sql.parameters)

// === clone ===
const baseQuery = Product.query().where("category", "=", "media")
const cloned = baseQuery.clone().orderBy("name", "asc")
console.log("clone: media items ordered:", (await cloned.execute()).length)

// === updateMany ===
const updated = await Product.query().where("category", "=", "media").updateMany({ price: 5.0 })
console.log("updateMany affected:", updated, "rows")

// === deleteMany ===
const deleted = await Product.query().where("name", "=", "Movie").deleteMany()
console.log("deleteMany affected:", deleted, "rows")

await peta.destroy()
