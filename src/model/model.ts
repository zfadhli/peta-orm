import type { Kysely } from "kysely"
import { DeleteBuilder, EagerLoader, ModelQueryBuilder, UpdateBuilder } from "../builder"
import { ValidationError } from "../columns/arktype-config"
import type { ColumnShape } from "../columns/column"
import { DatabaseError, ModelNotFoundError, ModelNotRegisteredError, normalizeError, RelationNotFoundError } from "../errors/errors"
import { HookManager, type LifecycleEvent } from "../hooks/lifecycle"
import type { Relation } from "../relations/relation"
import type { PetaLike } from "../types"

export type RelationMap = Record<string, Relation>

export type ModelClass<T extends Model = Model> = {
  new (): T
  table: string
  columns: ColumnShape
  relations: RelationMap
  peta: PetaLike | null
  hydrate(row: Record<string, unknown>): T
  query(): ModelQueryBuilder<T>
  find(id: number | string): Promise<T | undefined>
  findOrFail(id: number | string): Promise<T>
  on(event: LifecycleEvent, callback: (model: any) => void | Promise<void>): void
  readonly hooks: HookManager
  getGlobalScopes(): Map<string, (qb: any) => void>
  addGlobalScope(name: string, callback: (qb: any) => void): void
  removeGlobalScope(name: string): void
  transaction<TResult>(fn: (kysely: Kysely<any>) => Promise<TResult>): Promise<TResult>
  insert(data: Record<string, unknown>): Promise<T>
  insertMany(dataArray: Record<string, unknown>[], kysely?: Kysely<any>): Promise<T[]>
  update(id: number | string, data: Record<string, unknown>, kysely?: Kysely<any>): Promise<T>
  delete(id: number | string, kysely?: Kysely<any>): Promise<void>
  registerTimestamps(createdAtColumn?: string, updatedAtColumn?: string): void
  registerSoftDeletes(deletedAtColumn?: string): void
}

export type ColumnData = Record<string, unknown>

const hookManagerMap = new WeakMap<object, HookManager>()
const registeredTimestamps = new WeakSet<object>()
const registeredSoftDeletes = new WeakSet<object>()
let MODEL_ID = 0

export class Model {
  static table = ""
  static columns: ColumnShape = {}
  static relations: RelationMap = {}
  static peta: PetaLike | null = null

  static get hooks(): HookManager {
    let mgr = hookManagerMap.get(this)
    if (!mgr) {
      mgr = new HookManager()
      hookManagerMap.set(this, mgr)
    }
    return mgr
  }

  static on(event: LifecycleEvent, callback: (model: any) => void | Promise<void>): void {
    this.hooks.on(event, callback)
  }

  readonly #id: number
  #attributes: ColumnData = {}
  #original: ColumnData = {}
  #relations: Record<string, any> = {}
  #exists = false

  constructor() {
    this.#id = ++MODEL_ID
  }

  get exists(): boolean {
    return this.#exists
  }

  set exists(value: boolean) {
    this.#exists = value
  }

  get attributes(): Readonly<ColumnData> {
    return this.#attributes
  }

  get dirtyAttributes(): Partial<ColumnData> {
    const dirty: ColumnData = {}
    for (const key of Object.keys(this.#attributes)) {
      if (this.#attributes[key] !== this.#original[key]) {
        dirty[key] = this.#attributes[key]
      }
    }
    return dirty
  }

  get isDirty(): boolean {
    return Object.keys(this.dirtyAttributes).length > 0
  }

  static #FORBIDDEN = new Set<string>(["__proto__", "constructor", "prototype"])

  static $casts: Record<string, string> = {}
  static $hidden: string[] = []
  static $visible: string[] = []
  static $appends: string[] = []

  get(key: string): unknown {
    const modelClass = this.constructor as ModelClass
    const accessor = `get${key.charAt(0).toUpperCase() + key.slice(1)}Attribute`
    const self = this as any
    if (typeof self[accessor] === "function") {
      return self[accessor]()
    }
    const val = this.#attributes[key]
    const casts = (modelClass as any).$casts as Record<string, string>
    if (casts?.[key]) {
      return this.#castGet(val, casts[key])
    }
    return val
  }

  set(key: string, value: unknown): void {
    if (Model.#FORBIDDEN.has(key)) return
    const _modelClass = this.constructor as ModelClass
    const mutator = `set${key.charAt(0).toUpperCase() + key.slice(1)}Attribute`
    if (typeof (this as any)[mutator] === "function") {
      ;(this as any)[mutator](value)
      return
    }
    this.#attributes[key] = value
  }

  fill(data: Partial<ColumnData>): void {
    for (const [key, value] of Object.entries(data)) {
      if (Model.#FORBIDDEN.has(key)) continue
      this.set(key, value)
    }
  }

  #castGet(value: unknown, type: string): unknown {
    switch (type) {
      case "date":
        return value ? new Date(value as string) : value
      case "json":
        return typeof value === "string" ? JSON.parse(value) : value
      case "boolean":
        return value === true || value === 1 || value === "1" || value === "true"
      case "float":
        return value != null ? Number(value) : value
      case "integer":
        return value != null ? Math.round(Number(value)) : value
      default:
        return value
    }
  }

  reset(): void {
    this.#attributes = { ...this.#original }
  }

  $getRelation(name: string): Model | Model[] | null {
    return this.#relations[name] ?? null
  }

  $setRelation(name: string, value: Model | Model[] | Record<string, unknown> | null): void {
    this.#relations[name] = value as any
  }

  $hasRelation(name: string): boolean {
    return name in this.#relations
  }

  $relationData(): Record<string, Model | Model[] | null> {
    return { ...this.#relations }
  }

  async $load(...names: string[]): Promise<void> {
    const modelClass = this.constructor as ModelClass
    const loader = new EagerLoader()
    await loader.load(modelClass, this.#relations, [this], names)
  }

  $relatedQuery(name: string): ModelQueryBuilder<any> {
    const modelClass = this.constructor as ModelClass
    const relation = modelClass.relations[name]
    if (!relation) throw new RelationNotFoundError(modelClass.table, name)
    return relation.query(this)
  }

  toJSON(): ColumnData {
    return this.$toJSON()
  }

  $toJSON(visited?: WeakSet<Model>): ColumnData {
    visited = visited ?? new WeakSet()
    if (visited.has(this)) return { __circular: true }
    visited.add(this)

    const modelClass = this.constructor as ModelClass
    const hidden = ((modelClass as any).$hidden as string[]) || []
    const visible = ((modelClass as any).$visible as string[]) || []
    const appends = ((modelClass as any).$appends as string[]) || []

    let keys = Object.keys(this.#attributes)
    if (visible.length > 0) {
      keys = keys.filter((k) => visible.includes(k))
    }
    keys = keys.filter((k) => !hidden.includes(k))

    const data: ColumnData = {}
    for (const key of keys) {
      data[key] = this.get(key)
    }

    for (const key of appends) {
      const accessor = `get${key.charAt(0).toUpperCase() + key.slice(1)}Attribute`
      if (typeof (this as any)[accessor] === "function") {
        data[key] = (this as any)[accessor]()
      }
    }

    for (const [key, value] of Object.entries(this.#relations)) {
      if (hidden.includes(key)) continue
      if (visible.length > 0 && !visible.includes(key)) continue
      if (value === null) {
        data[key] = null
      } else if (Array.isArray(value)) {
        data[key] = value.map((m) => m.$toJSON(visited))
      } else {
        data[key] = value.$toJSON(visited)
      }
    }
    return data
  }

  async $save(): Promise<this> {
    const modelClass = this.constructor as ModelClass
    const peta = modelClass.peta
    if (!peta) throw new ModelNotRegisteredError(modelClass.name)
    const table = modelClass.table
    const columns = modelClass.columns
    const hooks = modelClass.hooks

    await hooks.trigger("beforeSave", this)

    if (this.#exists) {
      const dirty = this.dirtyAttributes
      if (Object.keys(dirty).length === 0) {
        await hooks.trigger("afterSave", this)
        return this
      }

      await hooks.trigger("beforeUpdate", this)

      for (const key of Object.keys(dirty)) {
        const col = columns[key]
        if (col) {
          try {
            col.assert(dirty[key])
          } catch (e) {
            if (e instanceof ValidationError) {
              throw new ValidationError(`${key}: ${e.message}`, e.errors)
            }
            throw e
          }
        }
      }

      const id = this.#attributes.id
      try {
        await peta.kysely.updateTable(table).set(dirty).where("id", "=", id).execute()
      } catch (e) {
        const normalized = normalizeError(e, table)
        if (normalized) throw normalized
        throw e
      }

      this.#original = { ...this.#attributes }
      await hooks.trigger("afterUpdate", this)
    } else {
      await hooks.trigger("beforeCreate", this)

      for (const [key, col] of Object.entries(columns)) {
        const value = this.#attributes[key] ?? col.defaultValue
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

      let result: any
      try {
        result = await peta.kysely.insertInto(table).values(this.#attributes).executeTakeFirst()
      } catch (e) {
        const normalized = normalizeError(e, table)
        if (normalized) throw normalized
        throw e
      }

      const insertId = (result as { insertId?: number | bigint })?.insertId
      if (insertId !== undefined) {
        this.#attributes.id = Number(insertId)
      }

      this.#exists = true
      this.#original = { ...this.#attributes }
      await hooks.trigger("afterCreate", this)
    }

    await hooks.trigger("afterSave", this)
    return this
  }

  async $delete(): Promise<void> {
    const modelClass = this.constructor as ModelClass
    const hooks = modelClass.hooks
    const peta = modelClass.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    const table = modelClass.table
    const id = this.#attributes.id
    if (id === undefined) throw new ModelNotFoundError(table)

    await hooks.trigger("beforeDelete", this)

    try {
      await peta.kysely.deleteFrom(table).where("id", "=", id).execute()
    } catch (e) {
      const normalized = normalizeError(e, table)
      if (normalized) throw normalized
      throw e
    }

    this.#exists = false
    await hooks.trigger("afterDelete", this)
  }

  async $forceDelete(): Promise<void> {
    const hooks = (this.constructor as ModelClass).hooks
    await hooks.trigger("beforeForceDelete", this)
    await this.$delete()
    await hooks.trigger("afterForceDelete", this)
  }

  async $restore(): Promise<void> {
    const hooks = (this.constructor as ModelClass).hooks
    await hooks.trigger("beforeRestore", this)
    await this.$save()
    await hooks.trigger("afterRestore", this)
  }

  $trashed(): boolean {
    return false
  }

  async $reload(): Promise<this> {
    const modelClass = this.constructor as ModelClass
    const peta = modelClass.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    const table = modelClass.table
    const id = this.#attributes.id
    if (id === undefined) return this

    const row = await peta.kysely.selectFrom(table).selectAll().where("id", "=", id).executeTakeFirst()

    if (row) {
      this.#attributes = { ...row } as ColumnData
      this.#original = { ...row } as ColumnData
    }

    return this
  }

  static query<T extends Model>(this: ModelClass<T>, kysely?: Kysely<any>): ModelQueryBuilder<T> {
    const peta = this.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    return new ModelQueryBuilder<T>(this, peta, kysely)
  }

  static async transaction<T>(this: ModelClass, fn: (kysely: Kysely<any>) => Promise<T>): Promise<T> {
    const peta = this.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    return await peta.transaction(fn)
  }

  static find<T extends Model>(this: ModelClass<T>, id: number | string): Promise<T | undefined> {
    return this.query().find(id)
  }

  static findOrFail<T extends Model>(this: ModelClass<T>, id: number | string): Promise<T> {
    return this.query().findOrFail(id)
  }

  static update<T extends Model>(
    this: ModelClass<T>,
    id: number | string,
    data: Record<string, unknown>,
    kysely?: Kysely<any>,
  ): Promise<T> {
    const peta = this.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    return new UpdateBuilder(this, peta, kysely).execute(id, data)
  }

  static delete<T extends Model>(this: ModelClass<T>, id: number | string, kysely?: Kysely<any>): Promise<void> {
    const peta = this.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    return new DeleteBuilder(this, peta, kysely).execute(id)
  }

  static hydrate<T extends Model>(this: ModelClass<T>, row: Record<string, unknown>): T {
    const instance = new this()
    instance.#attributes = { ...row }
    instance.#original = { ...row }
    instance.#exists = true
    return instance
  }

  static async insert<T extends Model>(this: ModelClass<T>, data: Record<string, unknown>): Promise<T> {
    const instance = new this()
    instance.fill(data)
    instance.#exists = false
    await instance.$save()
    return instance
  }

  static async insertMany<T extends Model>(
    this: ModelClass<T>,
    dataArray: Record<string, unknown>[],
    kysely?: Kysely<any>,
  ): Promise<T[]> {
    const peta = this.peta
    if (!peta) throw new ModelNotRegisteredError((this as any).name)
    const trx = kysely ?? peta.kysely
    const results: T[] = []
    for (const data of dataArray) {
      const instance = this.hydrate(data)
      let result: any
      try {
        result = await trx
          .insertInto(this.table)
          .values(data as Record<string, unknown>)
          .executeTakeFirst()
      } catch (e) {
        const normalized = normalizeError(e, this.table)
        if (normalized) throw normalized
        throw e
      }
      const insertId = (result as { insertId?: number | bigint })?.insertId
      if (insertId !== undefined) {
        instance.set("id", Number(insertId))
      }
      results.push(instance as T)
    }
    return results
  }

  static #globalScopes = new WeakMap<object, Map<string, (qb: any) => void>>()

  static addGlobalScope(name: string, callback: (qb: any) => void): void {
    let scopes = Model.#globalScopes.get(this)
    if (!scopes) {
      scopes = new Map()
      Model.#globalScopes.set(this, scopes)
    }
    scopes.set(name, callback)
  }

  static removeGlobalScope(name: string): void {
    const scopes = Model.#globalScopes.get(this)
    scopes?.delete(name)
  }

  static getGlobalScopes(): Map<string, (qb: any) => void> {
    return Model.#globalScopes.get(this) ?? new Map()
  }

  static registerTimestamps(createdAtColumn: string = "createdAt", updatedAtColumn: string = "updatedAt"): void {
    if (registeredTimestamps.has(this)) return
    registeredTimestamps.add(this)

    this.on("beforeCreate", (model) => {
      const now = new Date().toISOString()
      if (!model.get(createdAtColumn)) model.set(createdAtColumn, now)
      model.set(updatedAtColumn, now)
    })
    this.on("beforeUpdate", (model) => {
      model.set(updatedAtColumn, new Date().toISOString())
    })
  }

  static registerSoftDeletes(deletedAtColumn: string = "deletedAt"): void {
    const cls = this as any
    if (registeredSoftDeletes.has(cls as any)) return
    registeredSoftDeletes.add(cls as any)

    const origDelete = cls.prototype.$delete

    cls.prototype.$delete = async function () {
      const hooks = (cls as any).hooks as HookManager
      await hooks.trigger("beforeDelete", this)
      this.set(deletedAtColumn, new Date().toISOString())
      await this.$save()
      await hooks.trigger("afterDelete", this)
    }

    cls.prototype.$forceDelete = async function () {
      const hooks = (cls as any).hooks as HookManager
      await hooks.trigger("beforeForceDelete", this)
      await origDelete.call(this)
      await hooks.trigger("afterForceDelete", this)
    }

    cls.prototype.$restore = async function () {
      const hooks = (cls as any).hooks as HookManager
      await hooks.trigger("beforeRestore", this)
      this.set(deletedAtColumn, null)
      await this.$save()
      await hooks.trigger("afterRestore", this)
    }

    cls.prototype.$trashed = function () {
      const val = this.get(deletedAtColumn)
      return val !== null && val !== undefined
    }
  }
}
