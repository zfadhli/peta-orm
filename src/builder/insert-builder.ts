import type { Kysely } from "kysely"
import { ValidationError } from "../columns/arktype-config"
import type { Model, ModelClass } from "../model/model"
import type { PetaLike } from "../types"

export class InsertBuilder<T extends Model> {
  #modelClass: ModelClass<T>
  #kysely: Kysely<any>

  constructor(modelClass: ModelClass<T>, peta: PetaLike, kysely?: Kysely<any>) {
    this.#modelClass = modelClass
    this.#kysely = kysely ?? peta.kysely
  }

  async execute(data: Record<string, unknown>): Promise<T> {
    const columns = this.#modelClass.columns

    for (const [key, col] of Object.entries(columns)) {
      const value = data[key] ?? col.defaultValue
      if (value !== undefined && value !== null) {
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

    const result = await this.#kysely.insertInto(this.#modelClass.table).values(data).executeTakeFirst()

    const insertId = (result as { insertId?: number | bigint })?.insertId
    if (insertId !== undefined) {
      data = { ...data, id: Number(insertId) }
    }

    return this.#modelClass.hydrate(data)
  }
}
