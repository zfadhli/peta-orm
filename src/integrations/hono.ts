import type { PetaLike } from "../types"

export interface PetaHonoOptions {
  peta: PetaLike
}

export function petaMiddleware(options: PetaHonoOptions) {
  const { peta } = options

  return async (c: any, next: any) => {
    c.set("peta", peta)
    await next()
  }
}

export function modelParam(table: string) {
  return async (id: string, c: any) => {
    const peta = c.get("peta") as PetaLike | undefined
    if (!peta) throw new Error("Peta middleware not installed")

    const modelClass = peta.getModel(table)
    if (!modelClass) throw new Error(`Model for table "${table}" not registered`)

    const instance = await modelClass.find(Number(id))
    if (!instance) {
      c.status(404)
      return c.json({ error: "Not found" })
    }

    c.set("model", instance)
    return instance
  }
}
