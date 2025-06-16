import {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { blobHandleToUrl } from "./blob-handle-to-url";
import { loadImage } from "./image";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";

// For now leaving here because of the current dependencies between shared-ui on google-drive-kit.
export async function loadPart(
  googleDriveClient: GoogleDriveClient,
  part: StoredDataCapabilityPart | InlineDataCapabilityPart
): Promise<string | undefined> {
  if ("inlineData" in part) {
    return part.inlineData.data;
  }

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
