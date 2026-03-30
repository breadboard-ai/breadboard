/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UncompiledTemplateResult } from "lit";

export function isLitTemplateResult(
  value: unknown
): value is UncompiledTemplateResult {
  if (typeof value !== "object") return false;
  if (value === null) return false;
  const tmplValue = value as UncompiledTemplateResult;
  if (
    "_$litType$" in tmplValue &&
    typeof tmplValue._$litType$ !== "undefined"
  ) {
    return true;
  }

  return false;
}

export function isLitTemplateResultRecursive(value: unknown): unknown {
  let values: unknown[] | undefined = undefined;
  if (Array.isArray(value)) {
    values = value;
  } else if (value instanceof Map) {
    values = [...value.values()];
  } else if (value instanceof Set) {
    values = [...value];
  }

  if (values) {
    return values.some((v) => isLitTemplateResultRecursive(v));
  }

  return isLitTemplateResult(value);
}
