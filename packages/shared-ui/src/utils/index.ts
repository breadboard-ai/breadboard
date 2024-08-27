/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Schema,
  NodeValue,
  UnresolvedPathBoardCapability,
} from "@google-labs/breadboard";

export const isBoardBehavior = (
  schema: Schema,
  value: NodeValue
): value is UnresolvedPathBoardCapability | string | undefined => {
  if (!schema.behavior?.includes("board")) return false;
  if (!value) return true;
  if (typeof value === "string") return true;
  if (typeof value === "object") {
    const maybeCapability = value as UnresolvedPathBoardCapability;
    return maybeCapability.kind === "board" && !!maybeCapability.path;
  }
  return false;
};

export function isPortSpecBehavior(schema: Schema) {
  return schema.behavior?.includes("ports-spec");
}

export function isCodeBehavior(schema: Schema) {
  return schema.behavior?.includes("code");
}

export function isLLMContentBehavior(schema: Schema) {
  return schema.behavior?.includes("llm-content");
}

export function isLLMContentArrayBehavior(schema: Schema) {
  if (schema.type !== "array") return false;
  if (Array.isArray(schema.items)) return false;
  if (schema.items?.type !== "object") return false;
  if (!schema.items?.behavior?.includes("llm-content")) return false;

  return true;
}

export function behaviorsMatch(schema1: Schema, schema2: Schema): boolean {
  if (schema1.behavior?.length !== schema2.behavior?.length) {
    return false;
  }

  if (JSON.stringify(schema1.behavior) !== JSON.stringify(schema2.behavior)) {
    return false;
  }

  return true;
}

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

export function isSelect(schema: Schema) {
  return (
    (schema.enum && schema.enum.length > 0) ||
    (schema.examples && schema.examples.length > 0)
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
