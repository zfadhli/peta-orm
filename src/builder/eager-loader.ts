import { RelationNotFoundError } from "../errors/errors"
import type { Model, ModelClass } from "../model/model"
import type { ModelQueryBuilder } from "./query-builder"

export interface EagerLoad {
  name: string
  constraints: ((qb: ModelQueryBuilder<any>) => void) | null
}

export type WithArg = string | Record<string, ((qb: ModelQueryBuilder<any>) => void) | true>

export class EagerLoader {
  async load(
    modelClass: ModelClass,
    relationData: Record<string, Model | Model[] | null>,
    models: Model[],
    names: string[],
  ): Promise<void> {
    for (const name of names) {
      await this.#loadRelation(modelClass, relationData, models, name)
    }
  }

  async loadRelated(models: Model[], el: EagerLoad, modelClass: ModelClass): Promise<void> {
    const { name, constraints } = el
    await this.#loadRelation(modelClass, {}, models, name, constraints)
  }

  async #loadRelation(
    modelClass: ModelClass,
    relationData: Record<string, Model | Model[] | null>,
    models: Model[],
    name: string,
    constraints?: ((qb: ModelQueryBuilder<any>) => void) | null,
  ): Promise<void> {
    const dotIndex = name.indexOf(".")
    if (dotIndex > 0) {
      const primary = name.slice(0, dotIndex)
      const nested = name.slice(dotIndex + 1)
      const relation = modelClass.relations[primary]
      if (!relation) throw new RelationNotFoundError(modelClass.table, primary)
      await this.#loadRelation(modelClass, relationData, models, primary, null)

      const allRelated: Model[] = []
      for (const m of models) {
        const rel = m.$getRelation(primary)
        if (Array.isArray(rel)) allRelated.push(...rel)
      }
      if (allRelated.length > 0) {
        await this.#loadRelation(relation.relatedModelClass, {}, allRelated, nested, null)
      }
      return
    }

    const relation = modelClass.relations[name]
    if (!relation) throw new RelationNotFoundError(modelClass.table, name)

    await relation.loadEager(models, name, constraints)
  }
}
