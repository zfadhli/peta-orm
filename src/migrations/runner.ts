import type { Kysely } from "kysely"
import { sql } from "kysely"
import type { MigrationFile, MigrationRecord, MigrationStatus } from "./types"

export class MigrationRunner {
  readonly #db: Kysely<any>
  readonly #table: string

  constructor(db: Kysely<any>, table = "_peta_migrations") {
    this.#db = db
    this.#table = table
  }

  async ensureTable(): Promise<void> {
    await this.#db.schema
      .createTable(this.#table)
      .ifNotExists()
      .addColumn("name", "varchar", (c) => c.notNull().primaryKey())
      .addColumn("applied_at", "timestamp", (c) => c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
      .execute()
  }

  async getCompleted(): Promise<MigrationRecord[]> {
    try {
      const rows = await this.#db
        .selectFrom(this.#table)
        .select(["name", "applied_at"])
        .orderBy("name", "asc")
        .execute()
      return rows.map((r) => ({ name: r.name as string, appliedAt: r.applied_at as string }))
    } catch {
      return []
    }
  }

  async up(migrations: MigrationFile[]): Promise<void> {
    await this.ensureTable()
    const completed = await this.getCompleted()
    const completedNames = new Set(completed.map((r) => r.name))
    const pending = migrations.filter((m) => !completedNames.has(m.name)).sort(byName)

    for (const m of pending) {
      await m.up(this.#db)
      await this.#db
        .insertInto(this.#table)
        .values({ name: m.name, applied_at: new Date().toISOString() })
        .execute()
    }
  }

  async down(migrations: MigrationFile[]): Promise<void> {
    const completed = await this.getCompleted()
    if (completed.length === 0 || migrations.length === 0) return

    const applied = migrations
      .filter((m) => completed.some((r) => r.name === m.name))
      .sort(byName)
      .reverse()

    const lastBatch = applied[0]?.name
    if (!lastBatch) return

    for (const m of applied) {
      await m.down(this.#db)
      await this.#db.deleteFrom(this.#table).where("name", "=", m.name).execute()
    }
  }

  async status(migrations: MigrationFile[]): Promise<MigrationStatus> {
    const completed = await this.getCompleted()
    const completedNames = new Set(completed.map((r) => r.name))
    const pending = migrations.filter((m) => !completedNames.has(m.name)).sort(byName)
    return { completed, pending }
  }
}

function byName(a: MigrationFile, b: MigrationFile): number {
  return a.name.localeCompare(b.name)
}
