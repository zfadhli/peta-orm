import type { PetaLike } from "../types"

export interface PetaElysiaOptions {
  peta: PetaLike
}

export function petaPlugin(options: PetaElysiaOptions) {
  const { peta } = options

  const store: Record<string, any> = {}
  for (const [table, modelClass] of peta.models) {
    store[table] = modelClass
  }

  return {
    name: "peta",
    store: { models: store, peta },
  }
}
