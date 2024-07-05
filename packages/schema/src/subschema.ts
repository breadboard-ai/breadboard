/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4, JSONSchema4TypeName } from "json-schema";

export type JsonSubSchemaAnalysis =
  | { isSubSchema: true; details?: never }
  | { isSubSchema: false; details: JsonSubSchemaAnalysisDetail[] };

export interface JsonSubSchemaAnalysisDetail {
  pathA: Array<string | number>;
  pathB: Array<string | number>;
}

interface Context {
  pathA: Array<string | number>;
  pathB: Array<string | number>;
  details: JsonSubSchemaAnalysisDetail[];
}

const PASS_AND_SKIP_REMAINING_CHECKS = Symbol();
const FAIL_AND_SKIP_REMAINING_CHECKS = Symbol();

type Checker = (
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
) =>
  | boolean
  | typeof PASS_AND_SKIP_REMAINING_CHECKS
  | typeof FAIL_AND_SKIP_REMAINING_CHECKS;

const CHECKERS: Checker[] = [
  // IMPORTANT: anyOf must come first because it can skip the other checks.
  checkAnyOf,
  checkType,
  checkEnum,

  // string
  checkStringLength,
  checkStringPattern,
  checkStringFormat,

  // number
  checkNumberRange,

  // array
  checkArrayItems,

  // object
  checkObjectProperties,
  checkObjectAdditionalProperties,
  checkObjectRequiredProperties,
];

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/type}
 */
const ALL_TYPES = new Set<JSONSchema4TypeName>([
  "string",
  "number",
  "integer",
  "object",
  "array",
  "boolean",
  "null",
]);

const ALL_TYPES_SCHEMA = { type: [...ALL_TYPES] };

/**
 * Given the JSON Schemas `a` and `b`, determine whether `a` is a sub-schema of
 * `b`, and if not explain why.
 *
 * We say that `a` is a sub-schema of `b` if every JSON Schema constraint in `b`
 * is also present in `a` at an equal or higher strictness. Examples:
 *
 * - If `b` enforces type `string OR number`, then `a` must enforce either
 *   `string`, `number`, or `string OR number`.
 * - If `b` enforces `maxLength` 4, then `a` must enforce `maxLength <= 4` .
 *
 * Note that the following JSON Schema features are NOT yet implemented by this
 * function:
 *
 *   - ~~$ref~~
 *   - ~~allOf / oneOf / not~~
 *   - ~~const~~
 *   - ~~contains~~
 *   - ~~contentEncoding / contentMediaType~~
 *   - ~~dependentRequired / dependentSchemas / dependencies~~
 *   - ~~exclusiveMinimum / exclusiveMaximum~~
 *   - ~~if / then / else~~
 *   - ~~minContains / maxContains~~
 *   - ~~minItems / maxItems~~
 *   - ~~minProperties / maxProperties~~
 *   - ~~multipleOf~~
 *   - ~~prefixItems / uniqueItems / unevaluatedItems~~
 *   - ~~propertyNames / patternProperties / unevaluatedProperties~~
 *   - ~~tuple~~
 *
 * @param a The JSON Schema that is potentially a subset of `b`.
 * @param b The JSON Schema that is potentially a superset of `a`.
 *
 * @returns A {@link JsonSubSchemaAnalysis} object. Use the
 * {@link JsonSubSchemaAnalysis.isSubSchema} property to check whether `a` is a
 * subschema of `b`. When {@link JsonSubSchemaAnalysis.isSubSchema} is `false`,
 * use the {@link JsonSubSchemaAnalysis.details} property to get a detailed
 * explanation of why `a` is not a subschema of `b`.
 */
export function analyzeIsJsonSubSchema(
  // TODO(aomarks) Should we be using something newer like JSONSchema7? Maybe we
  // accept multiple versions?
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context = { pathA: [], pathB: [], details: [] }
): JsonSubSchemaAnalysis {
  let anyChecksFailed = false;
  for (const checker of CHECKERS) {
    const result = checker(a, b, context);
    if (result === true) {
      // N/A
    } else if (result === false) {
      anyChecksFailed = true;
      // Continue because we want to accumulate multiple errors.
    } else if (result === PASS_AND_SKIP_REMAINING_CHECKS) {
      break;
    } else if (result === FAIL_AND_SKIP_REMAINING_CHECKS) {
      anyChecksFailed = true;
      break;
    } else {
      result satisfies never;
    }
  }
  if (anyChecksFailed) {
    return { isSubSchema: false, details: context.details };
  }
  return { isSubSchema: true };
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/type}
 */
function checkType(a: JSONSchema4, b: JSONSchema4, context: Context): boolean {
  if (a.type === b.type) {
    // Fast path to avoid Set allocations for very common simple case of e.g.
    // `{type: "string"} vs `{type: "number"}.
    return true;
  }
  const aTypes = normalizedTypes(a);
  const bTypes = normalizedTypes(b);
  if (aTypes.has("integer") && bTypes.has("number")) {
    // All integers are numbers, but not all numbers are integers. So, here is
    // special handling to allow the case where A is an integer and B is a
    // number (but not vice-versa).
    aTypes.delete("integer");
    aTypes.add("number");
  }
  if (!isSubsetOf(aTypes, bTypes)) {
    context.details.push({
      pathA: [...context.pathA, "type"],
      pathB: [...context.pathB, "type"],
    });
    return false;
  }
  return true;
}

function normalizedTypes(schema: JSONSchema4): Set<JSONSchema4TypeName> {
  if (schema.type === undefined) {
    // No type means all types.
    return ALL_TYPES;
  }
  return coerceSet(schema.type);
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/enum}
 */
function checkEnum(a: JSONSchema4, b: JSONSchema4, context: Context): boolean {
  if (b.enum === undefined) {
    return true;
  }
  if (
    a.enum === undefined ||
    (a.enum.length === 0 && b.enum.length > 0) ||
    !isSubsetOf(coerceSet(a.enum), coerceSet(b.enum))
  ) {
    context.details.push({
      pathA: [...context.pathA, "enum"],
      pathB: [...context.pathB, "enum"],
    });
    return false;
  }
  return true;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/string#length}
 */
function checkStringLength(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (b.minLength === undefined && b.maxLength === undefined) {
    return true;
  }

  let ok = true;

  const aMin = a.minLength ?? 0;
  const bMin = b.minLength ?? 0;
  if (aMin < bMin) {
    ok = false;
    context.details.push({
      pathA: [...context.pathA, "minLength"],
      pathB: [...context.pathB, "minLength"],
    });
  }

  const aMax = a.maxLength ?? Number.MAX_VALUE;
  const bMax = b.maxLength ?? Number.MAX_VALUE;
  if (aMax > bMax) {
    ok = false;
    context.details.push({
      pathA: [...context.pathA, "maxLength"],
      pathB: [...context.pathB, "maxLength"],
    });
  }

  return ok;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/string#regexp}
 */
function checkStringPattern(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (b.pattern === undefined) {
    return true;
  }
  if (a.pattern !== b.pattern) {
    context.details.push({
      pathA: [...context.pathA, "pattern"],
      pathB: [...context.pathB, "pattern"],
    });
    return false;
  }
  return true;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/string#format}
 */
function checkStringFormat(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (b.format === undefined) {
    return true;
  }
  if (a.format !== b.format) {
    context.details.push({
      pathA: [...context.pathA, "format"],
      pathB: [...context.pathB, "format"],
    });
    return false;
  }
  return true;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/numeric#range}
 */
function checkNumberRange(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (b.minimum === undefined && b.maximum === undefined) {
    return true;
  }

  const aMin = a.minimum ?? 0;
  const bMin = b.minimum ?? 0;
  if (aMin < bMin) {
    context.details.push({
      pathA: [...context.pathA, "minimum"],
      pathB: [...context.pathB, "minimum"],
    });
    return false;
  }
  const aMax = a.maximum ?? Number.MAX_VALUE;
  const bMax = b.maximum ?? Number.MAX_VALUE;
  if (aMax > bMax) {
    context.details.push({
      pathA: [...context.pathA, "maximum"],
      pathB: [...context.pathB, "maximum"],
    });
    return false;
  }
  return true;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/array#items}
 */
function checkArrayItems(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (b.items === undefined) {
    return true;
  }
  if (Array.isArray(a.items) || Array.isArray(b.items)) {
    // TODO(aomarks) Implement tuple support.
    return true;
  }
  // TODO(aomarks) Recurse in a way that won't lose context (once context is
  // actually used for anything).
  context.pathA.push("items");
  context.pathB.push("items");
  const ok = analyzeIsJsonSubSchema(
    a.items ?? ALL_TYPES_SCHEMA,
    b.items,
    context
  ).isSubSchema;
  context.pathA.pop();
  context.pathB.pop();
  return ok;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/object#properties}
 */
function checkObjectProperties(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (a.properties === undefined || b.properties === undefined) {
    return true;
  }
  for (const [name, bProperty] of Object.entries(b.properties)) {
    const aProperty = a.properties[name];
    if (aProperty === undefined) {
      continue;
    }
    context.pathA.push("properties", name);
    context.pathB.push("properties", name);
    const ok = analyzeIsJsonSubSchema(
      aProperty,
      bProperty,
      context
    ).isSubSchema;
    context.pathA.pop();
    context.pathA.pop();
    context.pathB.pop();
    context.pathB.pop();
    if (!ok) {
      return false;
    }
  }
  return true;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/object#additionalproperties}
 */
function checkObjectAdditionalProperties(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (b.additionalProperties ?? true) {
    return true;
  }
  if (a.additionalProperties ?? true) {
    context.details.push({
      pathA: [...context.pathA, "additionalProperties"],
      pathB: [...context.pathB, "additionalProperties"],
    });
    return false;
  }
  const aPropertyNames = new Set(Object.keys(a.properties ?? {}));
  const bPropertyNames = new Set(Object.keys(b.properties ?? {}));
  let ok = true;
  for (const name of aPropertyNames) {
    if (!bPropertyNames.has(name)) {
      ok = false;
      context.details.push({
        pathA: [...context.pathA, "properties", name],
        pathB: [...context.pathB, "additionalProperties"],
      });
    }
  }
  return ok;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/object#required}
 */
function checkObjectRequiredProperties(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
): boolean {
  if (typeof a.required === "boolean" || typeof b.required === "boolean") {
    // TODO(aomarks) Validate that required can't actually be a boolean. The
    // `json-schema` types package say that it can be, but the docs don't
    // mention this, so it doesn't seem right.
    return true;
  }
  if (b.required === undefined || b.required.length === 0) {
    return true;
  }
  const aRequired = new Set(a.required ?? []);
  let ok = true;
  for (let i = 0; i < b.required.length; i++) {
    const name = b.required[i];
    if (!aRequired.has(name)) {
      ok = false;
      context.details.push({
        pathA: [...context.pathA, "required"],
        pathB: [...context.pathB, "required", i],
      });
    }
  }
  return ok;
}

/**
 * {@link https://json-schema.org/understanding-json-schema/reference/combining#anyOf}
 */
function checkAnyOf(
  a: JSONSchema4,
  b: JSONSchema4,
  context: Context
):
  | boolean
  | typeof PASS_AND_SKIP_REMAINING_CHECKS
  | typeof FAIL_AND_SKIP_REMAINING_CHECKS {
  if (a.anyOf !== undefined) {
    // ALL possibilities from A must satisfy B.
    for (let idxA = 0; idxA < a.anyOf.length; idxA++) {
      const originalSubA = a.anyOf[idxA];
      const modifiedSubA = inheritParentConstraintsIntoAnyOfEntry(
        a,
        originalSubA
      );
      if (b.anyOf === undefined) {
        // B is NOT an `anyOf`, so check each A directly against B.
        //
        // We need to be a bit clever here, because we ARE passing down the
        // context, but we're doing so with "fake" paths (see
        // `inheritParentConstraintsIntoAnyOfEntry`). So we do this:
        //
        // 1. Make a temporary context so that we can easily isolate the details
        //    from this recursion from any other details we might already have.
        // 2. Undo the effect of `inheritParentConstraintsIntoAnyOfEntry` using
        //    `repairDetailPathsForInheritedProperties`.
        // 3. Merge back in the details we temporarily excluded in (1).
        const tempDetails: JsonSubSchemaAnalysisDetail[] = [];
        const tempContext = { ...context, details: tempDetails };
        context.pathA.push("anyOf", idxA);
        const ok = analyzeIsJsonSubSchema(
          modifiedSubA,
          b,
          tempContext
        ).isSubSchema;
        context.pathA.pop();
        context.pathA.pop();
        if (!ok) {
          context.details.push(
            ...repairDetailPathsForInheritedProperties(
              tempDetails,
              idxA,
              originalSubA
            )
          );
          return FAIL_AND_SKIP_REMAINING_CHECKS;
        }
      } else {
        // B is also an `anyOf`, so check that ALL possibilities from A
        // satisfies AT LEAST ONE posibility from B.
        //
        // PERFORMANCE WARNING: O(n^2) comparisons!
        let found = false;
        for (const subB of b.anyOf) {
          if (
            analyzeIsJsonSubSchema(
              modifiedSubA,
              inheritParentConstraintsIntoAnyOfEntry(b, subB)
              // Note we do NOT pass down context here because we don't want to
              // accumulate details, because we're _searching_ for a match, not
              // asserting a match.
            ).isSubSchema
          ) {
            found = true;
            break;
          }
        }
        if (!found) {
          context.details.push({
            pathA: [...context.pathA, "anyOf", idxA],
            pathB: [...context.pathB, "anyOf"],
          });
          return FAIL_AND_SKIP_REMAINING_CHECKS;
        }
      }
    }
    return PASS_AND_SKIP_REMAINING_CHECKS;
  } else if (b.anyOf !== undefined) {
    // Only B is an `anyOf`. Ensure that A satisfies AT LEAST ONE possibility
    // from B.
    for (const subB of b.anyOf) {
      if (
        analyzeIsJsonSubSchema(
          a,
          inheritParentConstraintsIntoAnyOfEntry(b, subB)
          // Note we do NOT pass down context here because we don't want to
          // accumulate details, because we're _searching_ for a match, not
          // asserting a match.
        ).isSubSchema
      ) {
        return PASS_AND_SKIP_REMAINING_CHECKS;
      }
    }
    context.details.push({
      pathA: [...context.pathA],
      pathB: [...context.pathB, "anyOf"],
    });
    return FAIL_AND_SKIP_REMAINING_CHECKS;
  } else {
    return true;
  }
}

/**
 * If you have e.g. `{ maxLength: 4, anyOf: { A, B } }` then the `maxLength`
 * constraint implicitly applies to both `A` and `B`. This function copies any
 * such constraints from a parent JSON schema object into one of its given
 * `anyOf` entries so that it can more easily be analyzed.
 *
 * See
 * {@link https://json-schema.org/understanding-json-schema/reference/combining#factoringschemas}.
 */
function inheritParentConstraintsIntoAnyOfEntry(
  parentSchema: JSONSchema4,
  anyOfEntry: JSONSchema4
): JSONSchema4 {
  if (Object.keys(parentSchema).length === 1) {
    // We assume `parent` has `anyOf`, so if there's only 1 property then it
    // must be `anyOf`, which we can ignore and save a copy.
    return anyOfEntry;
  }
  return { ...parentSchema, anyOf: undefined, ...anyOfEntry };
}

function repairDetailPathsForInheritedProperties(
  details: JsonSubSchemaAnalysisDetail[],
  idxA: number,
  anyOfEntry: JSONSchema4
): JsonSubSchemaAnalysisDetail[] {
  return details.map((detail) => {
    const { pathA, pathB } = detail;
    // If we see a path that's within the anyOf entry, but it's a property that
    // doesn't exist on the original anyOf entry, then it must have been
    // inherited, so we should trim off the first 2 path components because
    // really they came from the parent.
    if (
      pathA[0] === "anyOf" &&
      pathA[1] === idxA &&
      anyOfEntry[pathA[2]] === undefined
    ) {
      return {
        pathA: pathA.slice(2),
        pathB,
      };
    } else {
      return detail;
    }
  });
}

function coerceSet<T>(value: T | T[] | undefined): Set<T> {
  return new Set(
    value === undefined ? [] : Array.isArray(value) ? value : [value]
  );
}

// Replace with
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSubsetOf
// when Node 22 is our minimum version.
function isSubsetOf(a: Set<unknown>, b: Set<unknown>): boolean {
  if (a.size > b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}
