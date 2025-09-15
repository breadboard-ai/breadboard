/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataModelObjectValue } from "../types/types";

export function getData(
  data: DataModelObjectValue,
  path: string
): DataModelObjectValue | null {
  let model: DataModelObjectValue = data;
  for (const part of path.split("/")) {
    if (part === "") {
      model = data;
      continue;
    }

    if (!model) {
      return null;
    }

    if (typeof model !== "object" || Array.isArray(model)) {
      return model;
    }

    model = model[part];
  }

  return model;
}

export function setData(
  data: DataModelObjectValue,
  path: string,
  value: DataModelObjectValue
) {
  let model: DataModelObjectValue = data;
  const parts = path.split("/");
  const slug: string | undefined = parts.at(-1);
  for (let p = 0; p < parts.length - 1; p++) {
    const part = parts[p];
    if (part === "") {
      model = data;
      continue;
    }

    if (!model) {
      break;
    }

    if (typeof model !== "object" || Array.isArray(model)) {
      break;
    }

    model = model[part];
  }

  if (!model || !slug || typeof model !== "object" || Array.isArray(model)) {
    return;
  }

  model[slug] = value;
}
