import cac from "cac"
import ora from "ora"
import { mkdirSync, writeFileSync } from "fs"
import { resolve } from "path"
import { MigrationGenerator } from "./generator"
import { MigrationRunner } from "./runner"
import { loadConfig, loadMigrationFiles } from "./config"

export async function run(): Promise<void> {
  const cli = cac("peta")

  cli
    .command("migrate:init", "Create migrations directory and tracking table")
    .action(async () => {
      const config = await loadConfig()
      const spinner = ora("Setting up migrations...").start()
      mkdirSync(config.migrationsDir, { recursive: true })
      const runner = new MigrationRunner(config.getKysely())
      await runner.ensureTable()
      spinner.succeed(`Migrations directory created at ${config.migrationsDir}`)
    })

  cli
    .command("migrate:generate [name]", "Generate initial migration from models")
    .action(async (name?: string) => {
      const config = await loadConfig()
      const spinner = ora("Generating migration...").start()
      const gen = new MigrationGenerator()
      const code = gen.generateInitialMigration(config.getModels(), { name: name ?? "Initial" })
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
      const safeName = (name ?? "initial").replace(/[^a-zA-Z0-9_]/g, "_")
      const filename = resolve(config.migrationsDir, `${timestamp}_${safeName}.ts`)
      mkdirSync(config.migrationsDir, { recursive: true })
      writeFileSync(filename, code)
      spinner.succeed(`Created ${filename}`)
    })

  cli
    .command("migrate:up", "Apply pending migrations")
    .action(async () => {
      const config = await loadConfig()
      const migrations = await loadMigrationFiles(config.migrationsDir)
      if (migrations.length === 0) {
        console.log("No migration files found.")
        return
      }
      const runner = new MigrationRunner(config.getKysely())
      const status = await runner.status(migrations)
      if (status.pending.length === 0) {
        console.log("All migrations have been applied.")
        return
      }
      const spinner = ora(`Running ${status.pending.length} migration(s)...`).start()
      await runner.up(migrations)
      const completed = await runner.getCompleted()
      spinner.succeed(`Applied ${completed.length} migration(s)`)
    })

  cli
    .command("migrate:down", "Rollback last batch")
    .action(async () => {
      const config = await loadConfig()
      const migrations = await loadMigrationFiles(config.migrationsDir)
      if (migrations.length === 0) {
        console.log("No migration files found.")
        return
      }
      const runner = new MigrationRunner(config.getKysely())
      const completed = await runner.getCompleted()
      if (completed.length === 0) {
        console.log("Nothing to rollback.")
        return
      }
      const spinner = ora("Rolling back...").start()
      await runner.down(migrations)
      spinner.succeed(`Rolled back ${completed.length} migration(s)`)
    })

  cli
    .command("migrate:status", "Show migration status")
    .action(async () => {
      const config = await loadConfig()
      const migrations = await loadMigrationFiles(config.migrationsDir)
      const runner = new MigrationRunner(config.getKysely())
      const { completed, pending } = await runner.status(migrations)
      console.log(`\n  Completed: ${completed.length}`)
      for (const m of completed) {
        console.log(`    ✓ ${m.name}`)
      }
      console.log(`\n  Pending: ${pending.length}`)
      for (const m of pending) {
        console.log(`    · ${m.name}`)
      }
      console.log()
    })

  cli.help()
  cli.parse()
}
