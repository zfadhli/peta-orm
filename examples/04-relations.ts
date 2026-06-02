// Peta ORM — 04-relations
// HasMany, BelongsTo, HasOne, eager loading (.with()), nested, $relatedQuery, lazy load

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { ColumnShape } from "../src"
import { $t, ArkTypeSchemaConfig, BelongsTo, HasMany, HasOne, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Post extends Model {
  static override table = "posts"
  static override columns = {
    id: t.integer().primaryKey(),
    userId: t.integer().references(() => User, ["id"]),
    title: t.string(255),
  } satisfies ColumnShape
  static override relations = { author: new BelongsTo(() => User, { foreignKey: "userId" }) }
}

class Profile extends Model {
  static override table = "profiles"
  static override columns = {
    id: t.integer().primaryKey(),
    userId: t.integer().references(() => User, ["id"]),
    bio: t.text().nullable(),
  } satisfies ColumnShape
  static override relations = { user: new BelongsTo(() => User, { foreignKey: "userId" }) }
}

class Tag extends Model {
  static override table = "tags"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
  } satisfies ColumnShape
}

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
  } satisfies ColumnShape
  static override relations = {
    posts: new HasMany(() => Post, { foreignKey: "userId" }),
    profile: new HasOne(() => Profile, { foreignKey: "userId" }),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, title TEXT NOT NULL)")
database.run("CREATE TABLE profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, bio TEXT)")
database.run("CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE post_tags (postId INTEGER NOT NULL, tagId INTEGER NOT NULL)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User, Post, Profile, Tag])

const alice = await User.insert({ name: "Alice" })
const bob = await User.insert({ name: "Bob" })

const _p1 = await Post.insert({ userId: alice.get("id") as number, title: "Post 1" })
const _p2 = await Post.insert({ userId: alice.get("id") as number, title: "Post 2" })
await Post.insert({ userId: bob.get("id") as number, title: "Post 3" })

await Profile.insert({ userId: alice.get("id") as number, bio: "Alice's bio" })

// HasMany — eager load
const users = await User.query().with("posts").orderBy("id", "asc").execute()
console.log(`${users[0]!.get("name")} has ${(users[0]!.$getRelation("posts") as Model[]).length} posts`)

// BelongsTo
const posts = await Post.query().with("author").execute()
console.log(`"${posts[0]!.get("title")}" by ${(posts[0]!.$getRelation("author") as Model).get("name")}`)

// HasOne
const users2 = await User.query().with("profile").execute()
const profile = users2[0]!.$getRelation("profile") as Model | null
console.log(`${users2[0]!.get("name")}'s bio: ${profile?.get("bio") ?? "none"}`)

// $relatedQuery
const alicePosts = await alice.$relatedQuery("posts").execute()
console.log(`Alice has ${alicePosts.length} posts directly`)

// Nested eager loading
const users3 = await User.query().with("posts.author").execute()
const firstPostAuthor = ((users3[0]!.$getRelation("posts") as Model[])[0]!.$getRelation("author") as Model).get("name")
console.log(`First post author: ${firstPostAuthor}`)

// Lazy load
const bobLoaded = await User.find(2)
await bobLoaded!.$load("posts")
console.log(`${bobLoaded!.get("name")} has ${(bobLoaded!.$getRelation("posts") as Model[]).length} post(s)`)

await peta.destroy()
