// Peta ORM — 19-collections-deep
// Full Collection + Paginator API
//   at, all, findBy, map/filter/reduce, forEach/each, find/some/includes/contains,
//   unique/sortBy/shuffle, take/skip/chunk, diff/intersect/push/concat, load, isNotEmpty,
//   min/max, and Paginator extras: hasPages, firstItem, lastItem, onFirstPage, onLastPage, count, map, toJSON

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Collection, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Item extends Model {
  static override table = "items"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255), category: t.string(50), score: t.double() }
}

const database = new Database(":memory:")
database.run("CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, score REAL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll(Item)

for (let i = 1; i <= 8; i++) {
  const cat = i <= 4 ? "A" : "B"
  await Item.insert({ name: `Item ${i}`, category: cat, score: i * 1.5 })
}

const items = await Item.query().orderBy("id", "asc").execute()
const col = new Collection(items)

// === at / all ===
console.log("at(0):", col.at(0)?.get("name"))
console.log("all length:", col.all().length)

// === findBy ===
console.log("findBy(3):", col.findBy(3)?.get("name"))

// === map / filter / reduce ===
console.log("map names:", col.map((i) => i.get("name")))
console.log("filter cat A:", col.filter((i) => i.get("category") === "A").length)
console.log("reduce score:", col.reduce((acc, i) => acc + (i.get("score") as number), 0))

// === forEach / each ===
col.forEach((i) => i.get("name"))
console.log("forEach: iterated", items.length, "items")

// === find / some / includes / contains ===
console.log("find score>5:", col.find((i) => (i.get("score") as number) > 5)?.get("name"))
console.log("some cat B:", col.some((i) => i.get("category") === "B"))
console.log("includes(items[0]):", col.includes(items[0]!))
console.log("contains('Item 3', 'name'):", col.contains("Item 3", "name"))

// === isEmpty / isNotEmpty ===
const empty = new Collection()
console.log("empty isEmpty:", empty.isEmpty())
console.log("col isNotEmpty:", col.isNotEmpty())

// === unique / sortBy / shuffle ===
console.log("unique categories:", col.unique("category").pluck("category"))
console.log("sortBy name asc:", col.sortBy("name").pluck("name"))
console.log("shuffle length:", col.shuffle().length)

// === take / skip / chunk ===
console.log("take(3):", col.take(3).pluck("name"))
console.log("skip(5):", col.skip(5).pluck("name"))
console.log("chunk(3) count:", col.chunk(3).length)

// === diff / intersect / push / concat ===
const subset = col.take(3)
const rest = col.skip(3)
console.log("diff length:", rest.diff(subset).length)
console.log("intersect length:", col.intersect(subset).length)
const copy = new Collection(subset.all())
copy.push(...rest.all())
console.log("push then all length:", copy.length)
const merged = subset.concat(rest)
console.log("concat length:", merged.length)

// === min / max ===
console.log("min score:", col.min("score"))
console.log("max score:", col.max("score"))

// === Paginator extras ===
const page1 = await (Item.query() as any).orderBy("id", "asc").paginate(1, 3)
console.log("hasPages:", page1.hasPages)
console.log("firstItem:", page1.firstItem)
console.log("lastItem:", page1.lastItem)
console.log("onFirstPage:", page1.onFirstPage)
console.log("onLastPage:", page1.onLastPage)
console.log("count:", page1.count)
console.log("map ids:", page1.map((i: any) => i.get("id")))
console.log("toJSON:", JSON.stringify(page1.toJSON()))

await peta.destroy()
