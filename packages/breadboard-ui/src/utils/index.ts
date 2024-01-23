/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "@google-labs/breadboard";

export function isMultiline(schema: Schema) {
  return schema.format == "multiline";
}

export function isSelect(schema: Schema) {
  return schema.enum && schema.enum.length > 0;
}

export function isBoolean(schema: Schema) {
  return schema.type == "boolean";
}

export function isMultipartImage(schema: Schema) {
  return schema.type === "object" && schema.format?.startsWith("image");
}

export function isMultipartText(schema: Schema) {
  return schema.type === "object" && schema.format?.startsWith("text");
}

export function isWebcam(schema: Schema) {
  return schema.format === "webcam";
}

export function isDrawable(schema: Schema) {
  return schema.format === "drawable";
}
