// cli/verbs/schema.ts — the `schema` verb (design/08 §5.1). A thin wrapper:
// stdout must byte-equal calling `buildSchemaDoc()` directly from the
// library (the A-STATE-VERB pattern, verb ↔ library equality).

import { buildSchemaDoc } from "../doc/schema.js";
import { parseZeroFileFlags } from "../args.js";
import { errOutcome, okOutcome, type VerbOutcome } from "./shared.js";

export interface SchemaVerbInput {
  readonly argv: readonly string[];
}

export function schemaVerb(input: SchemaVerbInput): VerbOutcome {
  const parsed = parseZeroFileFlags(input.argv);
  if (!parsed.ok) return errOutcome(parsed.error);
  const section = parsed.value.positional[0];
  const doc = buildSchemaDoc(section);
  if (!doc.ok) return errOutcome(doc.error);
  return okOutcome(doc.value);
}
