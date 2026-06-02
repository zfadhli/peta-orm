import type { Model, ModelClass } from "./model"

const GLOBAL_SCOPES = new WeakMap<object, Map<string, (qb: any) => void>>()

export function addScope(modelClass: ModelClass, name: string, callback: (qb: any) => void): void {
  let scopes = GLOBAL_SCOPES.get(modelClass)
  if (!scopes) {
    scopes = new Map()
    GLOBAL_SCOPES.set(modelClass, scopes)
  }
  scopes.set(name, callback)
}

export function removeScope(modelClass: ModelClass, name: string): void {
  const scopes = GLOBAL_SCOPES.get(modelClass)
  scopes?.delete(name)
}

export function getScopes(modelClass: ModelClass): Map<string, (qb: any) => void> {
  return GLOBAL_SCOPES.get(modelClass) ?? new Map()
}
