import { $t, ArkTypeSchemaConfig, Model } from "../../src"

const t = $t({ schema: new ArkTypeSchemaConfig() })

export class Discovered extends Model {
  static override table = "discovered"
  static override columns = {
    id: t.integer().primaryKey(),
    label: t.string(255),
  }
}
