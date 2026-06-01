import type { Kysely } from "kysely"
import type { ModelClass } from "./model/model"

declare const brand: unique symbol
export type ModelId = number & { [brand]: "ModelId" }

export interface PetaLike {
  readonly kysely: Kysely<any>
  register(modelClass: ModelClass): void
  registerAll(...classes: ModelClass[]): void
  discover(pattern: string): Promise<void>
  getModel(table: string): ModelClass | undefined
  readonly models: Map<string, ModelClass>
  transaction<T>(fn: (kysely: Kysely<any>) => Promise<T>): Promise<T>
  destroy(): Promise<void>
}
