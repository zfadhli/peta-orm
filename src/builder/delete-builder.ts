import type { Kysely } from "kysely"
import { normalizeError } from "../errors/errors"
import type { Model, ModelClass } from "../model/model"
import type { PetaLike } from "../types"

export class DeleteBuilder<T extends Model> {
  #modelClass: ModelClass<T>
  #kysely: Kysely<any>

  constructor(modelClass: ModelClass<T>, peta: PetaLike, kysely?: Kysely<any>) {
    this.#modelClass = modelClass
    this.#kysely = kysely ?? peta.kysely
  }

  async execute(id: number | string): Promise<void> {
    try {
      await this.#kysely.deleteFrom(this.#modelClass.table).where("id", "=", id).execute()
    } catch (e) {
      const normalized = normalizeError(e, this.#modelClass.table)
      if (normalized) throw normalized
      throw e
    }
  }
}
