import { EagerLoader } from "../builder"
import { RelationNotFoundError } from "../errors/errors"
import type { ModelQueryBuilder } from "../builder"
import type { Model, ModelClass } from "./model"
import { getRelation, setRelation, hasRelation, relationData, getRawRelations } from "./model-state"

export { getRelation as getModelRelation, setRelation as setModelRelation, hasRelation as hasModelRelation, relationData as modelRelationData }

export async function loadModelRelations(model: Model, ...names: string[]): Promise<void> {
  const modelClass = model.constructor as ModelClass
  const loader = new EagerLoader()
  await loader.load(modelClass, getRawRelations(model) as any, [model], names)
}

export function relatedQuery(model: Model, name: string): ModelQueryBuilder<any> {
  const modelClass = model.constructor as ModelClass
  const relation = modelClass.relations[name]
  if (!relation) throw new RelationNotFoundError(modelClass.table, name)
  return relation.query(model)
}
