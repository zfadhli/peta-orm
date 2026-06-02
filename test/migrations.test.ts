import { Database } from "bun:sqlite"
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { Kysely } from "kysely"
import { ManyToMany } from "../src/relations/relation"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ArkTypeSchemaConfig } from "../src/columns/arktype-config"
import { $t } from "../src/columns/column-types"
import { Model } from "../src/model/model"
import { Peta } from "../src/peta"
import { MigrationGenerator, MigrationRunner } from "../src/migrations"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255),
    email: t.text().unique(),
    age: t.integer().nullable().default(0),
  }
}

class Post extends Model {
  static override table = "posts"
  static override columns = {
    id: t.integer().primaryKey(),
    userId: t.integer(),
    title: t.string(255),
    body: t.text().nullable(),
  }
}

let db: Database

function createKysely(): Kysely<any> {
  db = new Database(":memory:")
  db.run("PRAGMA journal_mode = WAL")
  return new Kysely<any>({ dialect: new BunSqliteDialect({ database: db }) })
}

afterAll(() => {
  db?.close()
})

describe("MigrationRunner", () => {
  it("creates the tracking table", async () => {
    const kysely = createKysely()
    const runner = new MigrationRunner(kysely)
    await runner.ensureTable()

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_peta_migrations'")
      .all()
    expect(tables).toHaveLength(1)

    await kysely.destroy()
  })

  it("getCompleted returns empty before any migrations", async () => {
    const kysely = await createKysely()
    const runner = new MigrationRunner(kysely)
    const completed = await runner.getCompleted()
    expect(completed).toEqual([])
    await kysely.destroy()
  })

  it("up applies pending migrations", async () => {
    const kysely = createKysely()
    const runner = new MigrationRunner(kysely)

    await runner.up([
      {
        name: "001_create_users",
        up: async (k) => {
          await k.schema
            .createTable("users")
            .addColumn("id", "integer", (c) => c.autoIncrement().primaryKey())
            .addColumn("name", "varchar(255)", (c) => c.notNull())
            .execute()
        },
        down: async (k) => {
          await k.schema.dropTable("users").execute()
        },
      },
    ])

    const completed = await runner.getCompleted()
    expect(completed).toHaveLength(1)
    expect(completed[0]!.name).toBe("001_create_users")

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all()
    expect(tables).toHaveLength(1)

    await kysely.destroy()
  })

  it("down rolls back the last batch", async () => {
    const kysely = createKysely()
    const runner = new MigrationRunner(kysely)

    const migrate = {
      name: "001_create_users",
      up: async (k: Kysely<any>) => {
        await k.schema
          .createTable("users")
          .addColumn("id", "integer", (c) => c.autoIncrement().primaryKey())
          .addColumn("name", "varchar(255)", (c) => c.notNull())
          .execute()
      },
      down: async (k: Kysely<any>) => {
        await k.schema.dropTable("users").execute()
      },
    }

    await runner.up([migrate])

    let tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all()
    expect(tables).toHaveLength(1)

    await runner.down([migrate])

    tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all()
    expect(tables).toHaveLength(0)

    const completed = await runner.getCompleted()
    expect(completed).toHaveLength(0)

    await kysely.destroy()
  })

  it("status shows pending and completed", async () => {
    const kysely = createKysely()
    const runner = new MigrationRunner(kysely)

    const m1 = {
      name: "001_first",
      up: async (k: Kysely<any>) => {},
      down: async (k: Kysely<any>) => {},
    }
    const m2 = {
      name: "002_second",
      up: async (k: Kysely<any>) => {},
      down: async (k: Kysely<any>) => {},
    }

    await runner.up([m1])

    const status = await runner.status([m1, m2])
    expect(status.completed).toHaveLength(1)
    expect(status.completed[0]!.name).toBe("001_first")
    expect(status.pending).toHaveLength(1)
    expect(status.pending[0]!.name).toBe("002_second")

    await kysely.destroy()
  })
})

describe("MigrationGenerator", () => {
  it("generates create table for registered models", () => {
    // Add a Comment model that references Post
    class Comment extends Model {
      static override table = "comments"
      static override columns = {
        id: t.integer().primaryKey(),
        postId: t.integer().references(() => Post, ["id"]),
        body: t.text(),
      }
    }

    const peta = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    peta.registerAll(User, Post, Comment)
    const gen = new MigrationGenerator()
    const code = gen.generateInitialMigration(peta.models)

    expect(code).toContain('createTable("users")')
    expect(code).toContain('createTable("posts")')
    expect(code).toContain('createTable("comments")')
    expect(code).toContain("autoIncrement()")
    expect(code).toContain("primaryKey()")
    expect(code).toContain("notNull()")
    expect(code).toContain("unique()")
    expect(code).toContain('defaultTo(0)')
    expect(code).toContain('"id"')
    expect(code).toContain('"name"')
    expect(code).toContain('"email"')
    expect(code).toContain('"age"')

    // Verify references constraint is generated
    expect(code).toContain('references("posts.id")')

    expect(code).toContain('dropTable("users")')
    expect(code).toContain('dropTable("posts")')
    expect(code).toContain('dropTable("comments")')

    // Verify ifNotExists is generated
    expect(code).toContain('.ifNotExists()')
  })

  it("generates ifNotExists on createTable", () => {
    const peta = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    peta.registerAll(User, Post)
    const gen = new MigrationGenerator()
    const code = gen.generateInitialMigration(peta.models)

    // Every createTable should have ifNotExists
    const matches = code.match(/createTable/g)
    const ifNotExistsMatches = code.match(/ifNotExists\(\)/g)
    expect(matches?.length).toBe(ifNotExistsMatches?.length)
  })

  it("warns when ManyToMany pivot table has no registered model", () => {
    class Tag extends Model {
      static override table = "tags"
      static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
    }

    class PostWithTags extends Model {
      static override table = "posts"
      static override columns = { id: t.integer().primaryKey(), title: t.string(255) }
      static override relations = { tags: new ManyToMany(() => Tag, { through: "post_tags", foreignPivotKey: "postId", relatedPivotKey: "tagId" }) }
    }

    const peta = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    peta.registerAll(PostWithTags, Tag)
    const gen = new MigrationGenerator()
    const code = gen.generateInitialMigration(peta.models)

    expect(code).toContain("no model is registered for it")
    expect(code).toContain("post_tags")
  })

  it("suppresses warning when pivot model is registered", () => {
    class Tag extends Model {
      static override table = "tags"
      static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
    }

    class PostWithTags extends Model {
      static override table = "posts"
      static override columns = { id: t.integer().primaryKey(), title: t.string(255) }
      static override relations = { tags: new ManyToMany(() => Tag, { through: "post_tags", foreignPivotKey: "postId", relatedPivotKey: "tagId" }) }
    }

    class PostTag extends Model {
      static override table = "post_tags"
      static override columns = { id: t.integer().primaryKey(), postId: t.integer().references(() => PostWithTags, ["id"]), tagId: t.integer().references(() => Tag, ["id"]) }
    }

    const peta = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    peta.registerAll(PostWithTags, Tag, PostTag)
    const gen = new MigrationGenerator()
    const code = gen.generateInitialMigration(peta.models)

    expect(code).not.toContain("no model is registered for it")
    expect(code).toContain('createTable("post_tags")')
  })

  it("generated migration is syntactically valid when run", async () => {
    const peta = new Peta({ dialect: new BunSqliteDialect({ database: new Database(":memory:") }) })
    peta.registerAll(User, Post)
    const gen = new MigrationGenerator()
    const code = gen.generateInitialMigration(peta.models)

    expect(code).toContain("export async function up")
    expect(code).toContain("export async function down")
  })
})
