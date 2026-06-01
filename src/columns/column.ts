import type { Constraint, SchemaConfig } from "./schema-config"

export class Column<out T = unknown> {
  readonly #schema: SchemaConfig
  readonly #dataType: string
  readonly #args: unknown[]
  readonly #constraints: Constraint[]
  #compiled: unknown | null = null

  constructor(schema: SchemaConfig, dataType: string, args: unknown[] = []) {
    this.#schema = schema
    this.#dataType = dataType
    this.#args = args
    this.#constraints = []
  }

  get arkType(): unknown {
    if (!this.#compiled) {
      this.#compiled = this.#schema.compile(this.#dataType, this.#args, this.#constraints)
    }
    return this.#compiled
  }

  get dataType(): string {
    return this.#dataType
  }

  get args(): readonly unknown[] {
    return this.#args
  }

  get constraints(): readonly Constraint[] {
    return this.#constraints
  }

  get isNullable(): boolean {
    return this.#constraints.some((c) => c.type === "nullable")
  }

  get isPrimaryKey(): boolean {
    return this.#constraints.some((c) => c.type === "primaryKey")
  }

  get isUnique(): boolean {
    return this.#constraints.some((c) => c.type === "unique")
  }

  get defaultValue(): unknown {
    const c = this.#constraints.find((c) => c.type === "default")
    if (!c) return undefined
    const val = c.args[0]
    return typeof val === "function" ? val : val
  }

  hasConstraint(type: string): boolean {
    return this.#constraints.some((c) => c.type === type)
  }

  parse(value: unknown): T {
    return this.#schema.parse<T>(this.arkType, value)
  }

  assert(value: unknown): T {
    return this.#schema.assert<T>(this.arkType, value)
  }

  primaryKey(): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "primaryKey", args: [] }))
  }

  nullable(): Column<T | null> {
    return this.#clone((c) => c.#constraints.push({ type: "nullable", args: [] }))
  }

  default<V>(value: V): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "default", args: [value] }))
  }

  unique(): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "unique", args: [] }))
  }

  index(): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "index", args: [] }))
  }

  min(n: number): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "min", args: [n] }))
  }

  max(n: number): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "max", args: [n] }))
  }

  email(): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "email", args: [] }))
  }

  url(): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "url", args: [] }))
  }

  pattern(regex: RegExp | string): Column<T> {
    const source = typeof regex === "string" ? regex : regex.source
    return this.#clone((c) => c.#constraints.push({ type: "pattern", args: [source] }))
  }

  references(table: () => unknown, columns: string[]): Column<T> {
    return this.#clone((c) => c.#constraints.push({ type: "references", args: [table, columns] }))
  }

  #clone(mutate: (col: Column<T>) => void): Column<T> {
    const col = new Column<T>(this.#schema, this.#dataType, this.#args)
    col.#constraints.push(...this.#constraints)
    mutate(col as unknown as Column<never>)
    return col
  }
}

export type ColumnShape = Record<string, Column>

export type ColumnValue<C> = C extends Column<infer T> ? T : never
