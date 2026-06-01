// Peta ORM — 09-hono-integration
// Requires: bun add hono
// Peta middleware for Hono — model binding and error handling

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, DatabaseError, Model, Peta } from "../src"
import { petaMiddleware } from "../src/integrations/hono"

let Hono: any
try {
  Hono = (await import("hono")).Hono
} catch {
  console.log("Skipping: requires 'bun add hono'")
  process.exit(0)
}

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255), email: t.text().email() }
}

class Page extends Model {
  static override table = "pages"
  static override columns = { id: t.integer().primaryKey(), slug: t.string(255).unique(), title: t.string(255) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL)")
database.run("CREATE TABLE pages (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User, Page])

await User.insert({ name: "Alice", email: "alice@example.com" })
await User.insert({ name: "Bob", email: "bob@example.com" })

const app = new Hono()
app.use("*", petaMiddleware({ peta }))

app.get("/users", async (c: any) => {
  const page = Number(c.req.query("page") || 1)
  const perPage = Number(c.req.query("perPage") || 10)
  const result = await User.query().orderBy("id", "asc").paginate(page, perPage)
  return c.json({
    data: result.data.map((u: any) => u.$toJSON()),
    total: result.total,
    page: result.currentPage,
    perPage: result.perPage,
  })
})

app.post("/pages", async (c: any) => {
  const { slug, title } = await c.req.json()
  try {
    const page = await Page.insert({ slug, title })
    return c.json({ id: page.get("id"), slug: page.get("slug") }, 201)
  } catch (e) {
    if (e instanceof DatabaseError && e.code === "UNIQUE_CONSTRAINT") {
      return c.json({ error: "Slug already taken" }, 400)
    }
    throw e
  }
})

console.log("Hono integration ready (bun add hono to run)")
await peta.destroy()
