// Peta ORM — 10-elysia-integration
// Requires: bun add elysia
// Peta plugin for Elysia — models available in store

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, BelongsTo, HasMany, Model, Peta } from "../src"

try {
  await import("elysia")
} catch {
  console.log("Skipping: requires 'bun add elysia'")
  process.exit(0)
}

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Post extends Model {
  static override table = "posts"
  static override columns = { id: t.integer().primaryKey(), userId: t.integer(), title: t.string(255) }
  static override relations = { author: new BelongsTo(() => User, { foreignKey: "userId" }) }
}

class User extends Model {
  static override table = "users"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  static override relations = { posts: new HasMany(() => Post, { foreignKey: "userId" }) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, title TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User, Post])

const alice = await User.insert({ name: "Alice" })
await Post.insert({ userId: alice.get("id") as number, title: "Post 1" })

console.log("Elysia integration ready (bun add elysia to run)")
await peta.destroy()
