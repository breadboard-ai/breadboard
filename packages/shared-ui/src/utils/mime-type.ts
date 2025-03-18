/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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