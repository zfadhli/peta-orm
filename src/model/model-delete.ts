import type { Kysely } from "kysely"
import { ModelNotFoundError, ModelNotRegisteredError, normalizeError } from "../errors/errors"
import type { Model, ModelClass } from "./model"
import { getAttr, getExists, getState, setExists, setAttr } from "./model-state"
import { saveModel } from "./model-save"

export async function deleteModel(model: Model): Promise<void> {
  const modelClass = model.constructor as ModelClass
  const hooks = modelClass.hooks
  const peta = modelClass.peta
  if (!peta) throw new ModelNotRegisteredError((modelClass as any).name)
  const table = modelClass.table
  const id = getAttr(model, "id")
  if (id === undefined) throw new ModelNotFoundError(table)

  await hooks.trigger("beforeDelete", model)

  try {
    await peta.kysely.deleteFrom(table).where("id", "=", id).execute()
  } catch (e) {
    const normalized = normalizeError(e, table)
    if (normalized) throw normalized
    throw e
  }

  setExists(model, false)
  await hooks.trigger("afterDelete", model)
}

export async function forceDeleteModel(model: Model): Promise<void> {
  const hooks = (model.constructor as ModelClass).hooks
  await hooks.trigger("beforeForceDelete", model)
  await deleteModel(model)
  await hooks.trigger("afterForceDelete", model)
}

export async function restoreModel(model: Model): Promise<void> {
  const hooks = (model.constructor as ModelClass).hooks
  await hooks.trigger("beforeRestore", model)
  await saveModel(model)
  await hooks.trigger("afterRestore", model)
}

export function trashedModel(model: Model): boolean {
  return false
}

export async function reloadModel(model: Model): Promise<Model> {
  const modelClass = model.constructor as ModelClass
  const peta = modelClass.peta
  if (!peta) throw new ModelNotRegisteredError((modelClass as any).name)
  const table = modelClass.table
  const id = getAttr(model, "id")
  if (id === undefined) return model

  const row = await peta.kysely.selectFrom(table).selectAll().where("id", "=", id).executeTakeFirst()

  if (row) {
    const state = getState(model)
    state.attributes = { ...row } as Record<string, unknown>
    state.original = { ...row } as Record<string, unknown>
  }

  return model
}
