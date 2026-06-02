import type { Kysely } from "kysely"

export interface MigrationFile {
  name: string
  up: (db: Kysely<any>) => Promise<void>
  down: (db: Kysely<any>) => Promise<void>
}

export interface MigrationRecord {
  name: string
  appliedAt: string
}

export interface MigrationStatus {
  completed: MigrationRecord[]
  pending: MigrationFile[]
}
