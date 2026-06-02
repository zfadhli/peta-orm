import { type as arktype } from "arktype"
import type { Constraint, SchemaConfig } from "./schema-config"
import { ValidationError } from "../errors/errors"

export class ArkTypeSchemaConfig implements SchemaConfig {
  compile(dataType: string, args: unknown[], constraints: Constraint[]): unknown {
    const def = this.#buildDef(dataType, args, constraints)
    return (arktype as (def: string) => unknown)(def)
  }

  #buildDef(dataType: string, args: unknown[], constraints: Constraint[]): string {
    let lower: number | undefined
    let upper: number | undefined
    let nullable = false
    let hasEmail = false
    let hasUrl = false
    let pattern: string | undefined

    for (const c of constraints) {
      switch (c.type) {
        case "min":
          lower = c.args[0] as number
          break
        case "max":
          upper = c.args[0] as number
          break
        case "email":
          hasEmail = true
          break
        case "url":
          hasUrl = true
          break
        case "pattern":
          pattern = c.args[0] as string
          break
        case "nullable":
          nullable = true
          break
      }
    }

    let def = ""

    const typeName = this.#typeName(dataType, args)
    const sub = this.#subTypeStr(dataType, hasEmail, hasUrl)

    // Sub-constraints (.email, .url) attach directly after the type name
    const typeWithSub = typeName + sub

    if (lower !== undefined && upper !== undefined) {
      def += `${lower} <= ${typeWithSub} <= ${upper}`
    } else {
      def += typeWithSub
      if (lower !== undefined) def += ` >= ${lower}`
      if (upper !== undefined) def += ` <= ${upper}`
    }

    if (pattern) def += ` & /${pattern}/`

    if (nullable) def += " | null"

    return def
  }

  #typeName(dataType: string, args: unknown[]): string {
    switch (dataType) {
      case "integer":
      case "smallint":
      case "bigint":
        return "number.integer"
      case "float":
      case "double":
      case "decimal":
        return "number"
      case "string":
      case "varchar":
      case "text":
        return "string"
      case "boolean":
        return "boolean"
      case "timestamp":
      case "date":
        return "string.date.iso"
      case "json":
      case "jsonb":
        return "unknown"
      case "uuid":
        return "string.uuid"
      case "enum":
        return (args as string[]).map((v) => JSON.stringify(v)).join(" | ")
      default:
        return "unknown"
    }
  }

  #subTypeStr(dataType: string, hasEmail: boolean, hasUrl: boolean): string {
    if (dataType !== "string" && dataType !== "varchar" && dataType !== "text") return ""
    if (hasEmail) return ".email"
    if (hasUrl) return ".url"
    return ""
  }

  parse<T>(schema: unknown, value: unknown): T {
    const result = (schema as (v: unknown) => unknown)(value)
    if (result instanceof arktype.errors) {
      const problems = (result as any).flatProblemsByPath ?? {}
      const message = Object.entries(problems)
        .map(([path, msgs]) => `${path}: ${(msgs as string[]).join(", ")}`)
        .join("; ")
      throw new ValidationError(message, result)
    }
    return result as T
  }

  assert<T>(schema: unknown, value: unknown): T {
    const t = schema as { assert: (v: unknown) => T }
    try {
      return t.assert(value)
    } catch (e: unknown) {
      const err = e as { arkErrors?: unknown }
      if (err.arkErrors) {
        const errors = err.arkErrors as any
        const problems = errors.flatProblemsByPath ?? {}
        const message = Object.entries(problems)
          .map(([path, msgs]) => `${path}: ${(msgs as string[]).join(", ")}`)
          .join("; ")
        throw new ValidationError(message, errors)
      }
      throw e
    }
  }
}
