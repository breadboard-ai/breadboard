/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4, JSONSchema4TypeName } from "json-schema";

export function isSubset(a: JSONSchema4, b: JSONSchema4): SubsetResult {
  console.log(`isSubset<${JSON.stringify(a)}, ${JSON.stringify(b)}>`);
  const context: IsSubsetContext = { path: [] };
  for (const checker of [
    // all
    isSubsetType,
    // string
    isSubsetStringLength,
    isSubsetStringPattern,
    isSubsetStringFormat,
    // number
    isSubsetNumberRange,
    // array
    isSubsetArrayItems,
    // object
    isSubsetObjectProperties,
    isSubsetObjectAdditionalProperties,
    isSubsetObjectRequiredProperties,
  ]) {
    const r = checker(a, b, context);
    if (!r) {
      // TODO(aomarks) More detailed error messages.
      return { subset: false, errors: [] };
    }
  }
  if ((a.multipleOf ?? b.multipleOf) !== undefined) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring a multipleOf constraint because " +
        "support is not yet implemented."
    );
  }
  return { subset: true };
}

export type SubsetResult =
  | { subset: true; errors?: never }
  | { subset: false; errors: SubsetError[] };

export interface SubsetError {
  message: string;
}

// TODO(aomarks) Consider removing until it's actually used for something.
interface IsSubsetContext {
  path: string[];
}

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

function isSubsetType(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  const aTypes = getNormalizedTypes(a);
  const bTypes = getNormalizedTypes(b);
  // console.log(`isSubsetType<${JSON.stringify(a)}, ${JSON.stringify(b)}>`);
  if (aTypes.has("integer") && bTypes.has("number")) {
    // All integers are numbers, but not all numbers are integers. So, here is
    // special handling to allow the case where A is an integer and B is a
    // number (but not vice-versa).
    aTypes.delete("integer");
    aTypes.add("number");
  }
  return isSubsetOf(aTypes, bTypes);
}

function isSubsetStringLength(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  if (b.minLength === undefined && b.maxLength === undefined) {
    return true;
  }

  const aMin = a.minLength ?? 0;
  const bMin = b.minLength ?? 0;
  if (aMin < bMin) {
    return false;
  }

  const aMax = a.maxLength ?? Number.MAX_VALUE;
  const bMax = b.maxLength ?? Number.MAX_VALUE;
  if (aMax > bMax) {
    return false;
  }

  return true;
}

function isSubsetStringPattern(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  if (b.pattern === undefined) {
    return true;
  }
  return a.pattern === b.pattern;
}

function isSubsetStringFormat(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  if (b.format === undefined) {
    return true;
  }
  return a.format === b.format;
}

function isSubsetNumberRange(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  if (
    a.exclusiveMinimum !== undefined ||
    a.exclusiveMaximum !== undefined ||
    b.exclusiveMinimum !== undefined ||
    b.exclusiveMaximum
  ) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is treating an exclusive numeric range " +
        "as inclusive because support is not yet implemented."
    );
  }

  if (b.minimum === undefined && b.maximum === undefined) {
    return true;
  }

  const aMin = a.minimum ?? 0;
  const bMin = b.minimum ?? 0;
  if (aMin < bMin) {
    return false;
  }
  const aMax = a.maximum ?? Number.MAX_VALUE;
  const bMax = b.maximum ?? Number.MAX_VALUE;
  if (aMax > bMax) {
    return false;
  }
  return true;
}

function isSubsetArrayItems(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  // console.log(`isSubsetArrayItems<${JSON.stringify(a)}, ${JSON.stringify(b)}>`);
  if (b.items === undefined) {
    return true;
  }
  if (Array.isArray(a.items) || Array.isArray(b.items)) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring a tuple because support " +
        "is not yet implemented."
    );
    return true;
  }
  if (a.prefixItems || b.prefixItems) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring a prefixItems constraint " +
        "on an array because support is not yet implemented."
    );
  }
  if (a.additionalItems || b.additionalItems) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring an additionalItems constraint " +
        "on an array because support is not yet implemented."
    );
  }
  if (a.unevaluatedItems || b.unevaluatedItems) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring an unevaluatedItems constraint " +
        "on an array because support is not yet implemented."
    );
  }
  if (
    a.contains !== undefined ||
    b.contains !== undefined ||
    a.minContains !== undefined ||
    b.minContains !== undefined ||
    a.maxContains !== undefined ||
    b.maxContains !== undefined
  ) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring a " +
        "contains/minContains/maxContains constraint on an array " +
        "because support is not yet implemented."
    );
  }
  if (
    a.minItems !== undefined ||
    b.minItems !== undefined ||
    a.maxItems !== undefined ||
    b.maxItems !== undefined
  ) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring a " +
        "minItems/maxItems constraint on an array " +
        "because support is not yet implemented."
    );
  }
  if (a.uniqueItems !== undefined || b.uniqueItems !== undefined) {
    // TODO(aomarks) Implement this.
    console.warn(
      "JSON Schema subset function is ignoring a " +
        "uniqueItems constraint on an array " +
        "because support is not yet implemented."
    );
  }
  // TODO(aomarks) Recurse in a way that won't lose context (once context is
  // actually used for anything).
  return isSubset(a.items ?? ALL_TYPES_SCHEMA, b.items).subset;
}

function isSubsetObjectProperties(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  if (b.properties === undefined) {
    return true;
  }
  if (a.properties !== undefined) {
    for (const [name, bProperty] of Object.entries(b.properties)) {
      const aProperty = a.properties[name];
      if (aProperty === undefined) {
        continue;
      }
      if (!isSubset(aProperty, bProperty).subset) {
        return false;
      }
    }
  }
  return true;
}

function isSubsetObjectAdditionalProperties(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  // console.log(
  //   `isSubsetAdditionalProperties<${JSON.stringify(a)}, ${JSON.stringify(b)}>`
  // );
  if (b.additionalProperties ?? true) {
    return true;
  }
  if (a.additionalProperties ?? true) {
    return false;
  }
  const aPropertyNames = new Set(Object.keys(a.properties ?? {}));
  const bPropertyNames = new Set(Object.keys(b.properties ?? {}));
  return isSubsetOf(aPropertyNames, bPropertyNames);
}

function isSubsetObjectRequiredProperties(
  a: JSONSchema4,
  b: JSONSchema4,
  _context: IsSubsetContext
): boolean {
  if (typeof a.required === "boolean" || typeof b.required === "boolean") {
    // TODO(aomarks) Validate that required can't actually be a boolean. The
    // `json-schema` types package say that it can be, but the docs don't
    // mention this, so it doesn't seem right.
    console.warn(
      `JSON Schema subset is ignoring a "required" property that is a boolean. ` +
        `Expected array of strings.`
    );
    return true;
  }
  if (b.required === undefined || b.required.length === 0) {
    return true;
  }
  const aRequired = new Set(a.required);
  const bRequired = new Set(b.required);
  console.log("XXXXXXXXXX", { aRequired, bRequired });
  return isSubsetOf(bRequired, aRequired);
}

function getNormalizedTypes(schema: JSONSchema4): Set<JSONSchema4TypeName> {
  if (schema.type === undefined) {
    return ALL_TYPES;
  }
  return coerceSet(schema.type);
}

function coerceArray<T>(value: T | T[] | undefined): Array<T> {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function coerceSet<T>(value: T | T[] | undefined): Set<T> {
  return new Set(coerceArray(value));
}

// Replace with
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSubsetOf
// when all our supported platforms support it.
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
