import { Database } from "bun:sqlite"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { readdirSync } from "fs"
import { resolve } from "path"
import type { ModelClass } from "../model/model"
import { isModelClass, Peta } from "../peta"
import type { MigrationFile, PetaMigrateConfig, ResolvedConfig } from "./types"

export function defineConfig(config: PetaMigrateConfig): PetaMigrateConfig {
  return config
}

function hasGlob(s: string): boolean {
  return /[*?]/.test(s)
}

async function resolveModels(models: PetaMigrateConfig["models"]): Promise<ModelClass[]> {
  if (Array.isArray(models)) return models

  const resolved: ModelClass[] = []
  const bunModule = await import("bun").catch(() => null)
  const Glob = bunModule?.Glob ?? null
  if (!Glob) throw new Error("String models pattern requires Bun")

  // Try as glob pattern
  let matched = false
  for await (const file of new Glob(models).scan()) {
    matched = true
    const mod = await import(resolve(file))
    for (const value of Object.values(mod as Record<string, unknown>)) {
      if (isModelClass(value)) resolved.push(value)
    }
  }

  // If no glob matches, try as exact file path (e.g. barrel file)
  if (!matched) {
    try {
      const mod = await import(resolve(models))
      for (const value of Object.values(mod as Record<string, unknown>)) {
        if (isModelClass(value)) resolved.push(value)
      }
    } catch {}
  }

  return resolved
}

export async function loadConfig(): Promise<ResolvedConfig> {
  const candidates = ["peta.config.ts", "peta.config.js", "peta.config.mjs"]
  let config: PetaMigrateConfig | undefined

  for (const file of candidates) {
    try {
      const mod = await import(resolve(file))
      if (mod.default) {
        config = mod.default
        break
      }
    } catch {
      continue
    }
  }

  if (!config) {
    throw new Error(
      "No peta.config.ts found in current directory. Create one:\n\n" +
        '  import { defineConfig } from "peta-orm/migrator"\n' +
        '  export default defineConfig({\n' +
        '    migrationsDir: "./migrations",\n' +
        "    models: [],\n" +
        "  })",
    )
  }

  const db = new Database(":memory:")
  const peta = new Peta({ dialect: new BunSqliteDialect({ database: db }) })

  const models = await resolveModels(config.models)
  peta.registerAll(...models)

  return {
    peta,
    migrationsDir: config.migrationsDir,
    getKysely: () => peta.kysely,
    getModels: () => peta.models,
  }
}

export async function loadMigrationFiles(dir: string): Promise<MigrationFile[]> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  const files: MigrationFile[] = []

  for (const entry of entries.sort()) {
    if (!entry.endsWith(".ts") && !entry.endsWith(".js")) continue
    if (entry.startsWith(".")) continue

    const abs = resolve(dir, entry)
    const mod = await import(abs)
    if (typeof mod.up === "function" && typeof mod.down === "function") {
      files.push({ name: entry.replace(/\.(ts|js)$/, ""), up: mod.up, down: mod.down })
    }
  }

  return files
}
