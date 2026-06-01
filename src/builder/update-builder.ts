import type { Kysely } from "kysely"
import { ValidationError } from "../columns/arktype-config"
import { ModelNotFoundError, normalizeError } from "../errors/errors"
import type { Model, ModelClass } from "../model/model"
import type { PetaLike } from "../types"

export class UpdateBuilder<T extends Model> {
  #modelClass: ModelClass<T>
  #kysely: Kysely<any>

  constructor(modelClass: ModelClass<T>, peta: PetaLike, kysely?: Kysely<any>) {
    this.#modelClass = modelClass
    this.#kysely = kysely ?? peta.kysely
  }

  async execute(id: number | string, data: Record<string, unknown>): Promise<T> {
    const columns = this.#modelClass.columns

    for (const [key, col] of Object.entries(columns)) {
      const value = data[key]
      if (value !== undefined) {
        try {
          col.assert(value)
        } catch (e) {
          if (e instanceof ValidationError) {
            throw new ValidationError(`${key}: ${e.message}`, e.errors)
          }
          throw e
        }
      }
    }

    let row: Record<string, unknown> | undefined
    try {
      row = (await this.#kysely
        .updateTable(this.#modelClass.table)
        .set(data)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst()) as Record<string, unknown> | undefined
    } catch (e) {
      const normalized = normalizeError(e, this.#modelClass.table)
      if (normalized) throw normalized
      throw e
    }

    if (!row) throw new ModelNotFoundError(this.#modelClass.table, id)
    return this.#modelClass.hydrate(row)
  }
}
