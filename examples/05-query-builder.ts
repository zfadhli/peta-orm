// Peta ORM — 05-query-builder
// where, orderBy, limit, offset, innerJoin, has, count

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, HasMany, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Post extends Model {
  static override table = "posts"
  static override columns = {
    id: t.integer().primaryKey(),
    userId: t.integer(),
    title: t.string(255),
    published: t.integer().default(0),
  }
}

class User extends Model {
  static override table = "users"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
  static override relations = { posts: new HasMany(() => Post, { foreignKey: "userId" }) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run(
  "CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, title TEXT NOT NULL, published INTEGER DEFAULT 0)",
)

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User, Post])

const alice = await User.insert({ name: "Alice" })
const bob = await User.insert({ name: "Bob" })

await Post.insert({ userId: alice.get("id") as number, title: "Public", published: 1 })
await Post.insert({ userId: alice.get("id") as number, title: "Draft", published: 0 })
await Post.insert({ userId: bob.get("id") as number, title: "Bobs Post", published: 1 })

// where
const adults = await User.query().where("name", "=", "Alice").execute()
console.log("Found:", adults[0]?.get("name"))

// orderBy + limit + offset
const page = await User.query().orderBy("id", "asc").limit(1).offset(0).execute()
console.log("First user:", page[0]?.get("name"))

// has — filter by relation existence
const withPosts = await User.query().has("posts").orderBy("id", "asc").execute()
console.log(
  "Users with posts:",
  withPosts.map((u: any) => u.get("name")),
)

// count
const total = await Post.query().count()
console.log("Total posts:", total)

// innerJoin
const usersWithPosts = await User.query().innerJoin("posts", "posts.userId", "users.id").selectAll("users").execute()
console.log("Users via join:", usersWithPosts.length)

await peta.destroy()
