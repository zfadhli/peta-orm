// peta.config.ts
// Configuration for the Peta CLI migration tools
// Models are registered here for schema generation via `peta migrate:generate`

// peta.config.ts
// Configuration for the Peta CLI migration tools
// Models are registered here for schema generation via `peta migrate:generate`

import { defineConfig } from "peta-orm/migrator"
// Replace with your actual model imports:
// import { User, Post } from "./src/models/user"

export default defineConfig({
  migrationsDir: "./migrations",
  models: [
    // User, Post,
  ],
})
