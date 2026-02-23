/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataPart,
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { blobHandleToUrl } from "../media/blob-handle-to-url.js";
import { loadImage } from "../media/image.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { asBase64DataUrl } from "../../data/common.js";
import { partToDriveFileId } from "@breadboard-ai/utils/google-drive/utils.js";

/**
 * Note this is a WeakMap so that cached data will get GC'd if the DataPart
 * object itself gets GC'd. It's important the key is a consistent object
 * reference, and not e.g. a string.
 */
const driveDataUrlCache = new WeakMap<DataPart, string>();

// For now leaving here because of the current dependencies between shared-ui on google-drive-kit.
export async function loadPartAsDataUrl(
  googleDriveClient: GoogleDriveClient,
  part: StoredDataCapabilityPart | InlineDataCapabilityPart
): Promise<string | undefined> {
  if ("inlineData" in part) {
    return part.inlineData.data;
  }

  const driveFileId = partToDriveFileId(part);
  if (driveFileId) {
    const cached = driveDataUrlCache.get(part);
    if (cached) {
      return cached;
    }
    const response = await googleDriveClient.getFileMedia(driveFileId);
    const dataUrl = await asBase64DataUrl(await response.blob());
    driveDataUrlCache.set(part, dataUrl);
    return dataUrl;
  }

  // TODO(aomarks) Everything below could do with some clean up.

  if (part.data) {
    // Already loaded.
    return part.data;
  }

  const url = blobHandleToUrl(part.storedData.handle)?.href;
  if (!url) {
    return undefined;
  }
  if (part.storedData.mimeType.includes("image/")) {
    const data = await loadImage(googleDriveClient, url);
    // Store with the part for future re-use.
    part.data = data;
    return data;
  } else {
    throw Error(
      `Internal error: Data part type isn't yet supported: ${JSON.stringify(part)}`
    );
  }
}
