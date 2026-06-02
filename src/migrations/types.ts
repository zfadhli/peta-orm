import type { Kysely } from "kysely"
import type { ModelClass } from "../model/model"

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

export interface PetaMigrateConfig {
  migrationsDir: string
  models: ModelClass[]
}

export interface ResolvedConfig {
  peta: import("../peta").Peta
  migrationsDir: string
  getKysely: () => import("kysely").Kysely<any>
  getModels: () => Map<string, ModelClass>
}
