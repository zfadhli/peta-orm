export class ValidationError extends Error {
  readonly errors: unknown
  constructor(message: string, errors?: unknown) {
    super(message)
    this.name = "ValidationError"
    this.errors = errors
  }
}

export class ModelNotFoundError extends Error {
  readonly modelClass?: string
  readonly id?: number | string

  constructor(modelClass?: string, id?: number | string) {
    const msg = modelClass ? `${modelClass} with id ${id} not found` : "Model not found"
    super(msg)
    this.name = "ModelNotFoundError"
    this.modelClass = modelClass
    this.id = id
  }
}

export class RelationNotFoundError extends Error {
  readonly modelClass?: string
  readonly relationName?: string

  constructor(modelClass?: string, relationName?: string) {
    const msg = modelClass ? `Relation "${relationName}" not found on ${modelClass}` : "Relation not found"
    super(msg)
    this.name = "RelationNotFoundError"
    this.modelClass = modelClass
    this.relationName = relationName
  }
}

export class ModelNotRegisteredError extends Error {
  readonly modelClass?: string

  constructor(modelClass?: string) {
    const msg = modelClass ? `${modelClass} is not registered with Peta` : "Model not registered with Peta"
    super(msg)
    this.name = "ModelNotRegisteredError"
    this.modelClass = modelClass
  }
}

const UNIQUE_CODES = new Set([
  "SQLITE_CONSTRAINT_UNIQUE",
  "SQLITE_CONSTRAINT_PRIMARYKEY",
  "23505",
  "ER_DUP_ENTRY",
])

const FOREIGN_KEY_CODES = new Set([
  "SQLITE_CONSTRAINT_FOREIGNKEY",
  "23503",
  "ER_NO_REFERENCED_ROW_2",
])

export class DatabaseError extends Error {
  readonly code: string
  override readonly cause?: unknown
  readonly table?: string

  constructor(code: string, message: string, cause?: unknown, table?: string) {
    super(message)
    this.name = "DatabaseError"
    this.code = code
    this.cause = cause
    this.table = table
  }
}

export function normalizeError(e: unknown, table?: string): DatabaseError | null {
  if (!e || typeof e !== "object") return null
  const err = e as Record<string, unknown>
  if (typeof err.code === "string") {
    if (UNIQUE_CODES.has(err.code)) {
      const col = typeof err.column === "string" ? ` on ${err.column}` : ""
      return new DatabaseError("UNIQUE_CONSTRAINT", `Unique constraint violation${col}`, e, table)
    }
    if (FOREIGN_KEY_CODES.has(err.code)) {
      return new DatabaseError("FOREIGN_KEY_CONSTRAINT", "Foreign key constraint violation", e, table)
    }
  }
  return null
}
