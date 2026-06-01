import type { Model } from "../model/model"

export type LifecycleEvent =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeSave"
  | "afterSave"
  | "beforeDelete"
  | "afterDelete"
  | "beforeRestore"
  | "afterRestore"
  | "beforeForceDelete"
  | "afterForceDelete"

export type HookCallback = (model: Model) => void | Promise<void>

export class HookManager {
  #hooks = new Map<LifecycleEvent, HookCallback[]>()

  on(event: LifecycleEvent, callback: HookCallback): () => void {
    const list = this.#hooks.get(event)
    if (list) {
      list.push(callback)
    } else {
      this.#hooks.set(event, [callback])
    }
    return () => this.off(event, callback)
  }

  off(event: LifecycleEvent, callback: HookCallback): void {
    const list = this.#hooks.get(event)
    if (!list) return
    const idx = list.indexOf(callback)
    if (idx !== -1) list.splice(idx, 1)
  }

  async trigger(event: LifecycleEvent, model: Model): Promise<void> {
    const list = this.#hooks.get(event)
    if (!list) return
    for (const cb of list) {
      await cb(model)
    }
  }

  clone(): HookManager {
    const mgr = new HookManager()
    for (const [event, callbacks] of this.#hooks) {
      mgr.#hooks.set(event, [...callbacks])
    }
    return mgr
  }
}
