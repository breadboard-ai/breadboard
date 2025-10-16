/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome, StoredDataCapabilityPart } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { toBlobStoredData };

const BLOB_PREFIX = new URL("/board/blobs/", window.location.href).href;

export type BlobStoredData = {
  part: {
    storedData: {
      handle: string;
      mimeType: string;
      bucketId: string;
    };
  };
};

async function toBlobStoredData(
  fetchWithCreds: typeof globalThis.fetch,
  part: StoredDataCapabilityPart
): Promise<Outcome<BlobStoredData>> {
  const handle = part.storedData.handle;
  if (handle.startsWith(BLOB_PREFIX)) {
    try {
      const gettingBucket = await new Memoize(async () => {
        const response = await fetchWithCreds(
          new URL(`/api/data/transform/bucket`, window.location.href)
        );
        return response.json();
      }).get();
      if (!ok(gettingBucket)) return gettingBucket;
      const bucketId = (gettingBucket as { bucketId: string }).bucketId;
      if (!bucketId) {
        return err(`Failed to get bucket name: invalid response from server`);
      }
      return {
        part: {
          storedData: {
            ...part.storedData,
            bucketId,
          },
        },
      };
    } catch (e) {
      return err(`Failed to get bucket name: ${(e as Error).message}`);
    }
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

class Memoize<T> {
  static #promise: Promise<unknown> | null = null;
  #initializer: () => Promise<T>;

  constructor(initializer: () => Promise<T>) {
    this.#initializer = initializer;
  }

  get(): Promise<T> {
    if (Memoize.#promise === null) {
      Memoize.#promise = this.#initializer();
    }
    return Memoize.#promise as Promise<T>;
  }
}
