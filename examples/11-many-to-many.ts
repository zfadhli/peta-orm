// Peta ORM — 11-many-to-many
// ManyToMany via pivot table, pivotExtras option

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, ManyToMany, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class Tag extends Model {
  static override table = "tags"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
}

class Post extends Model {
  static override table = "posts"
  static override columns = { id: t.integer().primaryKey(), title: t.string(255) }
  static override relations = {
    tags: new ManyToMany(() => Tag, {
      through: "post_tags",
      foreignPivotKey: "postId",
      relatedPivotKey: "tagId",
      pivotExtras: ["sortOrder"],
    }),
  }
}

const database = new Database(":memory:")
database.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)")
database.run("CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run("CREATE TABLE post_tags (postId INTEGER NOT NULL, tagId INTEGER NOT NULL, sortOrder INTEGER DEFAULT 0)")

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([Post, Tag])

const post = await Post.insert({ title: "My Post" })
const tag1 = await Tag.insert({ name: "tech" })
const tag2 = await Tag.insert({ name: "life" })

// Link tags to post via pivot table
await peta.kysely
  .insertInto("post_tags")
  .values({ postId: post.get("id") as number, tagId: tag1.get("id") as number, sortOrder: 1 })
  .execute()
await peta.kysely
  .insertInto("post_tags")
  .values({ postId: post.get("id") as number, tagId: tag2.get("id") as number, sortOrder: 2 })
  .execute()

// Query related tags
const tags = await post.$relatedQuery("tags").execute()
console.log(
  `Post "${post.get("title")}" tags:`,
  tags.map((t: any) => t.get("name")),
)

// ManyToMany with pivotExtras — extra pivot columns stored in $getRelation("_pivot")
// Note: pivot extras require using addEagerConstraints (via .with()) or raw Kysely queries to include them
console.log("(pivotExtras option set — query returns related models, extras available via .with() eager loading)")

await peta.destroy()
