import { HookManager } from "../hooks/lifecycle"
import type { ModelClass } from "./model"

const HOOK_MAP = new WeakMap<object, HookManager>()
const TS_SET = new WeakSet<object>()
const SD_SET = new WeakSet<object>()

export function getHooksFor(modelClass: ModelClass): HookManager {
  let mgr = HOOK_MAP.get(modelClass)
  if (!mgr) {
    mgr = new HookManager()
    HOOK_MAP.set(modelClass, mgr)
  }
  return mgr
}

export function registerTimestampsFor(
  modelClass: ModelClass,
  createdAtColumn: string = "createdAt",
  updatedAtColumn: string = "updatedAt",
): void {
  if (TS_SET.has(modelClass)) return
  TS_SET.add(modelClass)

  modelClass.on("beforeCreate", (model: any) => {
    const now = new Date().toISOString()
    if (!model.get(createdAtColumn)) model.set(createdAtColumn, now)
    model.set(updatedAtColumn, now)
  })
  modelClass.on("beforeUpdate", (model: any) => {
    model.set(updatedAtColumn, new Date().toISOString())
  })
}

export function registerSoftDeletesFor(modelClass: ModelClass, deletedAtColumn: string = "deletedAt"): void {
  const cls = modelClass as any
  if (SD_SET.has(cls)) return
  SD_SET.add(cls)

  const origDelete = cls.prototype.$delete

  cls.prototype.$delete = async function () {
    const hooks = cls.hooks as HookManager
    await hooks.trigger("beforeDelete", this)
    this.set(deletedAtColumn, new Date().toISOString())
    await this.$save()
    await hooks.trigger("afterDelete", this)
  }

  cls.prototype.$forceDelete = async function () {
    const hooks = cls.hooks as HookManager
    await hooks.trigger("beforeForceDelete", this)
    await origDelete.call(this)
    await hooks.trigger("afterForceDelete", this)
  }

  cls.prototype.$restore = async function () {
    const hooks = cls.hooks as HookManager
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
