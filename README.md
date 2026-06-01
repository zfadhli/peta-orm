# Peta ORM

**Typed ORM for Bun, built on [Kysely](https://github.com/kysely-org/kysely)** with [ArkType](https://arktype.io) validation.

Column types, relations with eager loading, lifecycle hooks, timestamps, soft deletes, casting, serialization control, global scopes, polymorphic relations, and more — all fully typed end-to-end.

```ts
const user = await User.insert({ name: "Alice", email: "a@b.com" })
const posts = await user.$relatedQuery("posts").where("published", true).execute()
const page = await Post.query().with("author").paginate(1, 20)
```

---

## Quick Start

```bash
bun add peta-orm arktype kysely
bun add -d kysely-bun-sqlite
```

```ts
// db.ts
import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { Peta, $t, ArkTypeSchemaConfig, Model, HasMany } from "peta-orm"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255).min(2),
    email: t.text().email(),
  }
  static override relations = {
    posts: new HasMany(() => Post),
  }
}

class Post extends Model {
  static override table = "posts"
  static override columns = {
    id: t.integer().primaryKey(),
    userId: t.integer(),
    title: t.string(255),
  }
}

const database = new Database("my-app.db")
database.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL)`)
database.run(`CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, title TEXT NOT NULL)`)

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })

// Explicit registration (rest params, no array wrapper)
peta.registerAll(User, Post)

// Or auto-discover from directory (Bun only):
// await peta.discover("./src/**/*.model.ts")

export { peta, User, Post }
```

---

## Why Peta ORM?

| Feature | Raw Kysely | Peta ORM |
|---------|-----------|----------|
| **Validation** | Manual | Automatic from column definitions via ArkType |
| **Models** | Row types only | Class instances with `$save()`, `$delete()`, `$reload()` |
| **Relations** | Manual JOINs | Declarative `HasMany`, `BelongsTo`, `HasOne`, `ManyToMany` |
| **Eager loading** | Manual batch | `.with("posts.author")` — one line, batched queries |
| **Hooks** | — | `beforeCreate`, `afterUpdate`, `beforeDelete`, etc. |
| **Soft deletes** | — | `withTrashed()`, `onlyTrashed()`, `$restore()`, `$forceDelete()` |
| **Casting** | — | `$casts: { meta: "json", flags: "boolean" }` |
| **Serialization** | — | `$hidden`, `$visible`, `$appends`, accessors |
| **Pagination** | Manual offset/limit | `.paginate(1, 20)` — returns `{ data, total, perPage, ... }` |
| **Transactions** | Manual | `Model.transaction(fn)` |
| **Global scopes** | — | `addGlobalScope("active", qb => ...)` |

---

## Features

### Column Types & Validation

```ts
const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override columns = {
    id: t.integer().primaryKey(),
    name: t.string(255).min(2),          // min length
    email: t.text().email(),             // email format
    age: t.integer().nullable().min(0).max(150).default(0),
    role: t.enum("admin", "user").default("user"),
    score: t.double().nullable(),
    ...t.timestamps(),                   // createdAt, updatedAt
  }
}
```

### Relations & Eager Loading

```ts
class User extends Model {
  static override relations = {
    posts: new HasMany(() => Post, { foreignKey: "userId" }),
    profile: new HasOne(() => Profile, { foreignKey: "userId" }),
  }
}

// Eager load with dot notation
const users = await User.query()
  .with("posts")
  .with("posts.author")
  .with({ posts: (q) => q.where("published", true) })
  .execute()

// Lazy load after fetch
await user.$load("posts")
await collection.load("posts.author")

// Relation query
const posts = await user.$relatedQuery("posts").where("published", true).execute()

// Existence filters
const authors = await User.query().has("posts").execute()
const active = await User.query().whereHas("posts", (q) => q.where("published", true)).execute()
```

### CRUD & Pagination

```ts
// Insert
const user = await User.insert({ name: "Alice", email: "a@b.com" })

// Find
const found = await User.find(1)
const first = await User.query().where("email", "like", "%@b.com").first()

// Update
user.set("name", "Alice Updated")
await user.$save()
await User.update(1, { name: "Alice Updated" })

// Delete
await user.$delete()
await User.delete(1)

// Paginate
const page = await Post.query().orderBy("id", "asc").paginate(1, 20)
// → { data: Post[], total, perPage, currentPage, lastPage, hasMorePages }
```

### Hooks & Timestamps

```ts
class User extends Model {
  static {
    this.on("beforeCreate", (user) => { user.email = user.email.toLowerCase() })
    this.on("afterCreate", (user) => { console.log("Created:", user.get("id")) })
  }
}

User.registerTimestamps()  // auto-set createdAt/updatedAt
```

### Soft Deletes

```ts
User.registerSoftDeletes()

await user.$delete()         // sets deletedAt timestamp
await user.$restore()        // clears deletedAt
await user.$forceDelete()    // actually deletes

const active = await User.query().execute()                  // excludes deleted
const all = await User.query().withTrashed().execute()       // includes deleted
const trashed = await User.query().onlyTrashed().execute()   // only deleted
```

### Attribute Casting & Serialization

```ts
class User extends Model {
  static override $casts = {
    meta: "json",
    flags: "boolean",
    createdAt: "date",
  }
  static override $hidden = ["password"]
  static override $visible = ["id", "name", "email"]  // whitelist
  static override $appends = ["fullName"]

  getFullNameAttribute() { return `${this.get("first")} ${this.get("last")}` }
}

const json = user.$toJSON()  // password excluded, fullName appended, meta parsed
```

### Global Scopes & Transactions

```ts
User.addGlobalScope("active", (qb) => qb.where("active", "=", 1))

// Query without the scope
await User.query().withoutGlobalScope("active").execute()

// Transactions
await User.transaction(async (trx) => {
  await trx.insertInto("users").values({ name: "A" }).execute()
  await trx.insertInto("posts").values({ userId: 1, title: "B" }).execute()
})
```

### Error Handling

Database constraint violations (unique, foreign key) are normalized into a `DatabaseError` across SQLite, PostgreSQL, and MySQL:

```ts
import { DatabaseError } from "peta-orm"

try {
  const post = await Post.insert({ slug: "my-post", title: "..." })
} catch (e) {
  if (e instanceof DatabaseError && e.code === "UNIQUE_CONSTRAINT") {
    // slug already taken — return 400
    return c.json({ error: "Slug already taken" }, 400)
  }
  throw e
}
```

| `DatabaseError.code` | Meaning | Triggered by |
|---|---|---|
| `UNIQUE_CONSTRAINT` | Duplicate value on a unique column | `SQLITE_CONSTRAINT_UNIQUE`, PostgreSQL `23505`, MySQL `ER_DUP_ENTRY` |
| `FOREIGN_KEY_CONSTRAINT` | Referenced row doesn't exist | `SQLITE_CONSTRAINT_FOREIGNKEY`, PostgreSQL `23503`, MySQL `ER_NO_REFERENCED_ROW_2` |

The error also carries the `table` name and the original driver error via `cause`.

### Collection Utilities

```ts
const users = await User.query().execute()
const col = new Collection(users)

col.pluck("name")       // ["Alice", "Bob"]
col.groupBy("role")     // { admin: [...], user: [...] }
col.load("posts")       // eager load relations
col.sum("score")        // aggregate helpers
col.avg("age")
col.unique("role")
col.sortBy("name")
col.chunk(10)           // split into batches
```

---

## Examples

All self-contained (inline SQLite, run directly):

```bash
bun run examples/01-basic-setup.ts
bun run examples/04-relations.ts
bun run examples/07-soft-deletes.ts
```

| # | Example | Topic |
|---|---------|-------|
| 01 | [basic-setup](./examples/01-basic-setup.ts) | Peta init + SQLite setup |
| 02 | [model-definition](./examples/02-model-definition.ts) | Columns, types, modifiers, timestamps |
| 03 | [crud](./examples/03-crud.ts) | insert, find, update, delete, paginate |
| 04 | [relations](./examples/04-relations.ts) | HasMany, BelongsTo, HasOne, eager loading |
| 05 | [query-builder](./examples/05-query-builder.ts) | where, orderBy, join, has, count |
| 06 | [hooks-timestamps](./examples/06-hooks-timestamps.ts) | beforeCreate, afterCreate, registerTimestamps |
| 07 | [soft-deletes](./examples/07-soft-deletes.ts) | $delete, $restore, $forceDelete, withTrashed |
| 08 | [collection-paginator](./examples/08-collection-paginator.ts) | Collection, Paginator |
| 09 | [hono-integration](./examples/09-hono-integration.ts) | Hono app + error handling with `DatabaseError` |
| 10 | [elysia-integration](./examples/10-elysia-integration.ts) | Elysia app stub |
| 11 | [many-to-many](./examples/11-many-to-many.ts) | ManyToMany via pivot table |
| 12 | [transactions](./examples/12-transactions.ts) | Model.transaction(), rollback |
| 13 | [casting](./examples/13-casting.ts) | $casts, $hidden, $appends, accessors |
| 14 | [global-scopes](./examples/14-global-scopes.ts) | addGlobalScope(), withoutGlobalScope() |
| 15 | [batch](./examples/15-batch.ts) | insertMany, insertMany() |
| 16 | [discover](./examples/16-discover.ts) | peta.discover(), rest params |

---

## API Overview

| Module | Key exports | File |
|--------|-------------|------|
| **Core** | `Peta`, `Model`, `$t`, `Collection` | `src/index.ts` |
| **Discovery** | `peta.discover(glob)`, `peta.registerAll(...models)` | `src/peta.ts` |
| **Columns** | `t.integer()`, `t.string()`, `t.email()`, `.min()`, `.max()`, `.nullable()`, `.default()` | `src/columns/column-types.ts` |
| **Builders** | `.where()`, `.with()`, `.paginate()`, `.chunk()`, `.sum()`, `.toSQL()` | `src/builder/query-builder.ts` |
| **Relations** | `HasMany`, `BelongsTo`, `HasOne`, `ManyToMany`, `HasManyThrough` | `src/relations/Relation.ts` |
| **Polymorphic** | `MorphTo`, `MorphMany`, `MorphOne` | `src/relations/Morph.ts` |
| **Hooks** | `HookManager`, `on()`, `off()`, `trigger()` | `src/hooks/lifecycle.ts` |
| **Paginator** | `Paginator`, `.paginate()` | `src/pagination/Paginator.ts` |
| **Errors** | `ModelNotFoundError`, `RelationNotFoundError`, `ValidationError`, `DatabaseError` | `src/errors/errors.ts` |

---

## License

MIT
