/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Schema } from "@google-labs/breadboard";
import { behaviorsMatch } from "./behaviors.js";

export {
  isBoardBehavior,
  isBoardArrayBehavior,
  isPortSpecBehavior,
  isCodeBehavior,
  isLLMContentBehavior,
  isLLMContentArrayBehavior,
  behaviorsMatch,
  isConfigurableBehavior,
  isModuleBehavior,
  isTextBehavior,
} from "./behaviors.js";

export function itemsMatch(schema1: Schema, schema2: Schema): boolean {
  if (!schema1.items) return false;
  if (!schema2.items) return false;

  if (Array.isArray(schema1.items) || Array.isArray(schema2.items))
    return false;
  if (
    !Array.isArray(schema1.items) &&
    !Array.isArray(schema2.items) &&
    schema1.items?.type !== schema2.items?.type
  )
    return false;

  if (!behaviorsMatch(schema1.items, schema2.items)) {
    return false;
  }

  return true;
}

export function isMultiline(schema: Schema) {
  return (
    schema.format === "multiline" ||
    schema.type === "object" ||
    schema.type === "array"
  );
}

export function isEnum(schema: Schema) {
  return schema.enum && schema.enum.length > 0;
}

export function isBoolean(schema: Schema) {
  return schema.type == "boolean";
}

export function isMicrophoneAudio(schema: Schema) {
  return (
    schema.type === "object" &&
    schema.behavior?.includes("llm-content") &&
    schema.format === "audio-microphone"
  );
}

export function isMultipartText(schema: Schema) {
  return schema.type === "object" && schema.format?.startsWith("text");
}

export function isWebcamImage(schema: Schema) {
  return (
    schema.type === "object" &&
    schema.behavior?.includes("llm-content") &&
    schema.format === "image-webcam"
  );
}

export function isDrawableImage(schema: Schema) {
  return (
    schema.type === "object" &&
    schema.behavior?.includes("llm-content") &&
    schema.format === "image-drawable"
  );
}

export function isGoogleDriveFileId(schema: Schema) {
  return schema.behavior?.includes("google-drive-file-id");
}

export function isGoogleDriveQuery(schema: Schema) {
  return schema.behavior?.includes("google-drive-query");
}
