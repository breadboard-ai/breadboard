/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataCapability, InlineDataCapabilityPart } from "./types.js";

// Helpers for handling DataCapability objects.

export const isDataCapability = (value: unknown): value is DataCapability => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (data.kind !== "data") return false;
  if (!("inlineData" in data)) return false;
  return true;
};

export const asBlob = async (part: InlineDataCapabilityPart) => {
  const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  const response = await fetch(dataURL);
  const data = await response.blob();
  return data;
};
