import { Collection } from "../collection/collection"
import type { Model } from "../model/model"

export class Paginator<T extends Model> {
  readonly data: Collection<T>
  readonly total: number
  readonly perPage: number
  readonly currentPage: number
  readonly lastPage: number

  constructor(items: T[], total: number, perPage: number, currentPage: number) {
    this.data = new Collection(items)
    this.total = total
    this.perPage = perPage
    this.currentPage = currentPage
    this.lastPage = Math.max(Math.ceil(total / perPage), 1)
  }

  get hasMorePages(): boolean {
    return this.currentPage < this.lastPage
  }

  get hasPages(): boolean {
    return this.lastPage > 1
  }

  get firstItem(): number {
    return (this.currentPage - 1) * this.perPage + 1
  }

  get lastItem(): number {
    return Math.min(this.firstItem + this.data.length - 1, this.total)
  }

  get onFirstPage(): boolean {
    return this.currentPage <= 1
  }

  get onLastPage(): boolean {
    return this.currentPage >= this.lastPage
  }

  get count(): number {
    return this.data.length
  }

  map<U>(callback: (item: T, index: number) => U): U[] {
    return this.data.map(callback)
  }

  toJSON(): PaginatorJson<T> {
    return {
      data: this.data.toJSON(),
      total: this.total,
      perPage: this.perPage,
      currentPage: this.currentPage,
      lastPage: this.lastPage,
      hasMorePages: this.hasMorePages,
    }
  }
}

export interface PaginatedResult<T> extends PaginatorJson<T> {}

export interface PaginatorJson<_T> {
  data: Record<string, unknown>[]
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  hasMorePages: boolean
}
