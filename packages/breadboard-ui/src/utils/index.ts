/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "@google-labs/breadboard";

export function isMultiline(schema: Schema) {
  return (
    schema.format === "multiline" ||
    schema.type === "object" ||
    schema.type === "array"
  );
}

export function isSelect(schema: Schema) {
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

export function isLLMContent(schema: Schema) {
  return schema.type === "object" && schema.behavior?.includes("llm-content");
}

export function isLLMContentArray(schema: Schema) {
  return (
    schema.type &&
    schema.items &&
    schema.type === "array" &&
    !Array.isArray(schema.items) &&
    schema.items.type === "object" &&
    schema.items.behavior?.includes("llm-content")
  );
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
