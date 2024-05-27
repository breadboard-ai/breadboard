/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataCapability,
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "./types.js";

// Helpers for handling DataCapability objects.

export const isDataCapability = (value: unknown): value is DataCapability => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as DataCapability;
  if (data.kind !== "data") return false;
  if ("inlineData" in data) return true;
  if ("storedData" in data) return true;
  return false;
};

export const asBlob = async (
  part: InlineDataCapabilityPart | StoredDataCapabilityPart
) => {
  let url: string;
  if ("storedData" in part) {
    url = part.storedData.handle;
  } else {
    url = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  const response = await fetch(url);
  const data = await response.blob();
  return data;
};
