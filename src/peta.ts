import { type Dialect, Kysely } from "kysely"
import type { ModelClass } from "./model/model"
import type { PetaLike } from "./types"

export interface PetaConfig {
  dialect: Dialect
}

export class Peta implements PetaLike {
  readonly kysely: Kysely<any>
  readonly #models = new Map<string, ModelClass>()

  constructor(config: PetaConfig) {
    this.kysely = new Kysely<any>({ dialect: config.dialect })
  }

  register(modelClass: ModelClass): void {
    const table = modelClass.table
    if (!table) throw new Error(`Model ${modelClass.name} has no table name`)
    this.#models.set(table, modelClass)
    modelClass.peta = this
  }

  registerAll(classes: ModelClass[]): void {
    for (const cls of classes) {
      this.register(cls)
    }
  }

  getModel(table: string): ModelClass | undefined {
    return this.#models.get(table)
  }

  get models(): Map<string, ModelClass> {
    return this.#models
  }

  async transaction<T>(fn: (kysely: Kysely<any>) => Promise<T>): Promise<T> {
    return await this.kysely.transaction().execute((trx) => fn(trx))
  }

  async destroy(): Promise<void> {
    for (const [, cls] of this.#models) {
      ;(cls as any).peta = null
    }
    this.#models.clear()
    await this.kysely.destroy()
  }
}
