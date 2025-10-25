/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chunk, Outcome, StoredDataCapabilityPart } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory";

export { toBlobStoredData, toGcsAwareChunk };

const BLOB_PREFIX = new URL("/board/blobs/", window.location.href).href;

export type BlobStoredData = {
  part: StoredDataCapabilityPart;
};

async function toBlobStoredData(
  { fetchWithCreds }: A2ModuleArgs,
  part: StoredDataCapabilityPart
): Promise<Outcome<BlobStoredData>> {
  const handle = part.storedData.handle;
  if (handle.startsWith(BLOB_PREFIX)) {
    return { part };
  } else if (!handle.startsWith("drive:/")) {
    return err(`Unknown blob URL: "${handle}`);
  }
  const driveId = handle.replace("drive:/", "");
  const {
    storedData: { mimeType, resourceKey },
  } = part;
  const query = new URLSearchParams();
  query.append("mode", "blob");
  query.append("mimeType", mimeType);
  if (resourceKey) {
    query.append("resourceKey", resourceKey);
  }

  try {
    const blobifying = await fetchWithCreds(
      new URL(
        `/board/boards/@foo/bar/assets/drive/${driveId}?${query}`,
        window.location.href
      ),
      { method: "POST" }
    );
    if (!blobifying.ok) {
      return err(`Failed to convert Drive file to Blob`);
    }
    return blobifying.json();
  } catch (e) {
    return err(`Failed to convert Drive file to Blob: ${(e as Error).message}`);
  }
}

function toGcsAwareChunk(
  bucketId: string,
  blobStoreData: BlobStoredData
): Chunk {
  const {
    part: {
      storedData: { handle },
    },
  } = blobStoreData;

  // pluck blobId out
  const blobId = handle.split("/").slice(-1)[0];
  const path = `${bucketId}/${blobId}`;

  const data = btoa(String.fromCodePoint(...new TextEncoder().encode(path)));
  return { data, mimetype: "text/gcs-path" };
}
