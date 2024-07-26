/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  asBase64,
  asBlob,
  InlineDataCapabilityPart,
  isStoredData,
  StoredDataCapabilityPart,
} from "@google-labs/breadboard";

async function retrieveAsBlob(part: StoredDataCapabilityPart): Promise<Blob> {
  if (!isStoredData(part)) {
    throw new Error("Invalid stored data");
  }

  const { handle } = part.storedData;
  const response = await fetch(handle);
  return await response.blob();
}

export async function toInlineDataPart(part: StoredDataCapabilityPart) {
  const raw = await retrieveAsBlob(part);
  const mimeType = part.storedData.mimeType;
  const data = await asBase64(raw);
  return { inlineData: { mimeType, data } };
}

export async function toStoredDataPart(part: InlineDataCapabilityPart) {
  const blob = await asBlob(part);
  const handle = URL.createObjectURL(blob);

  return {
    storedData: {
      handle,
      mimeType: blob.type,
    },
  };
}
