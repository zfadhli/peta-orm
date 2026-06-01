import { ValidationError } from "../columns/arktype-config"

export { ValidationError }

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
