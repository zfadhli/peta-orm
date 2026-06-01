// Peta ORM — 12-transactions
// Model.transaction(), rollback behavior

import { Database } from "bun:sqlite"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { $t, ArkTypeSchemaConfig, Model, Peta } from "../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

class User extends Model {
  static override table = "users"
  static override columns = { id: t.integer().primaryKey(), name: t.string(255) }
}

class Account extends Model {
  static override table = "accounts"
  static override columns = { id: t.integer().primaryKey(), userId: t.integer(), balance: t.double() }
}

const database = new Database(":memory:")
database.run("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)")
database.run(
  "CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, balance REAL NOT NULL)",
)

const peta = new Peta({ dialect: new BunSqliteDialect({ database }) })
peta.registerAll([User, Account])

// Transaction using Model.transaction() static method
await User.transaction(async (trx) => {
  await trx.insertInto("users").values({ name: "Alice" }).execute()
  await trx.insertInto("users").values({ name: "Bob" }).execute()
})
console.log("Transaction 1 committed")

// Transaction with insert using Model class (runs in same transaction context)
const user = await User.insert({ name: "Charlie" })
const txResult = await peta.transaction(async (kysely) => {
  await kysely.insertInto("users").values({ name: "Dave" }).execute()
  await kysely
    .insertInto("accounts")
    .values({ userId: user.get("id") as number, balance: 100 })
    .execute()
  return user.get("id") as number
})
console.log("Inserted in transaction, result:", txResult)

// Transaction rolls back on error
try {
  await peta.transaction(async (kysely) => {
    await kysely.insertInto("users").values({ name: "Eve" }).execute()
    throw new Error("rollback")
  })
} catch {
  console.log("Transaction rolled back — Eve should not exist")
}

const allUsers = await User.query().orderBy("id", "asc").execute()
console.log(
  "Users after rollback:",
  allUsers.map((u: any) => u.get("name")),
)

await peta.destroy()
