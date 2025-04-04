/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";

/** Returns type of the asset for the given mimeType. */
export function getAssetType(mimeType?: string): string | undefined {
  if (!mimeType) {
    return;
  }

  const prefixes = ["image", "audio", "video", "text"];
  for (const prefix of prefixes) {
    if (mimeType.startsWith(prefix)) {
      return prefix;
    }
  }
}

export function getMimeType(data: LLMContent[]): string | undefined {
  for (const element of data) {
    for (const part of element.parts) {
      if ("inlineData" in part && part.inlineData.mimeType) {
        return part.inlineData.mimeType;
      } else if ("storedData" in part && part.storedData.mimeType) {
        return part.storedData.mimeType;
      } else if ("fileData" in part && part.fileData.mimeType) {
        return part.fileData.mimeType;
      }
    }
  }
}
