// Peta ORM — 17-instance-methods
// Instance methods: fill, dirtyAttributes, isDirty, exists, reset, $reload,
//   $relatedQuery, $load, $getRelation/$setRelation/$hasRelation/$relationData, $toJSON

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, BelongsTo, HasMany, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255), email: t.text().email() }
  static override relations = { posts: new HasMany(() => Post) }
}

class Post extends Model {
  static override table = "posts"
  static override columns = { id: t.integer().primaryKey(), userId: t.integer(), title: t.string(255) }
  static override relations = { author: new BelongsTo(() => User, { foreignKey: "userId" }) }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL)")
database.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, title TEXT NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll(User, Post)

// Insert seed data
const alice = await User.insert({ name: "Alice", email: "alice@example.com" })
await User.insert({ name: "Bob", email: "bob@example.com" })
const post = await Post.insert({ userId: alice.get("id") as number, title: "Post 1" })

// === fill() ===
const user = await User.find(1)!
user!.fill({ name: "Alice Updated", email: "alice@new.com" })
console.log("fill():", user!.$toJSON())

// === dirtyAttributes / isDirty ===
console.log("dirtyAttributes:", user!.dirtyAttributes)
console.log("isDirty:", user!.isDirty)

// === exists ===
console.log("exists (saved):", user!.exists)
const fresh = User.hydrate({ id: 99, name: "Ghost", email: "g@x.com" })
console.log("exists (hydrated):", fresh.exists)

// === reset() ===
user!.set("name", "Temporary")
console.log("after set before reset:", user!.get("name"))
user!.reset()
console.log("after reset:", user!.get("name"))

// === $reload() ===
await user!.$save()
user!.set("name", "Should revert")
await user!.$reload()
console.log("after $reload:", user!.get("name"))

// === $relatedQuery() ===
const relatedPosts = await user!.$relatedQuery("posts").execute()
console.log("$relatedQuery posts:", relatedPosts.length, "items")

// === $load() ===
const user3 = await User.find(1)!
await user3!.$load("posts")
console.log("$load posts:", user3!.$getRelation("posts"))

// === $getRelation / $setRelation / $hasRelation / $relationData ===
user!.$setRelation("posts", [post])
console.log("$hasRelation posts:", user!.$hasRelation("posts"))
console.log("$getRelation posts:", user!.$getRelation("posts")?.length, "items")
console.log("$relationData keys:", Object.keys(user!.$relationData()))

// === $toJSON() ===
console.log("$toJSON:", user!.$toJSON())

await peta.destroy()
