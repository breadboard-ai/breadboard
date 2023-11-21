/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "../types.js";

export const isMultipart = (schema: Schema) => {
  return schema.type == "array" && schema.format == "multipart";
};

export const createMultipartInput = (schema: Schema, key: string) => {
  const span = document.createElement("span");
  const textarea = span.appendChild(document.createElement("textarea"));
  textarea.name = key;
  textarea.placeholder = schema.description || "";
  textarea.value = schema.default ?? "";
  return span;
};

export const getMultipartValue = (form: HTMLFormElement, key: string) => {
  const value = form[key]?.value;
  return {
    html: value,
    value,
  };
};
