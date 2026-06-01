// Peta ORM — 16-discover
// Auto-discover models from the filesystem with peta.discover()
//
// Run from repo root:
//   bun run examples/16-discover.ts

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Page extends Model {
  static override table = "pages"
  static override columns = {
    id: t.integer().primaryKey(),
    slug: t.string(255),
    title: t.string(255),
  }
}

class Author extends Model {
  static override table = "authors"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE pages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, title TEXT NOT NULL)")
database.run("CREATE TABLE authors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })

// Register without array wrapper
peta.registerAll(Page, Author)

// Or with a glob if models were in separate files:
// await peta.discover("./src/**/*.model.ts")

console.log("Registered models:", [...peta.models.keys()])

await Page.insert({ slug: "hello", title: "Hello World" })
await Author.insert({ name: "Alice" })

console.log("Pages:", (await Page.query().execute()).map((p) => p.$toJSON()))
console.log("Authors:", (await Author.query().execute()).map((a) => a.$toJSON()))

await peta.destroy()
