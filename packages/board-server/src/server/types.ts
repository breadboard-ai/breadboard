/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Outcome } from "@breadboard-ai/types";

export type BlobStore = {
  saveBuffer(buffer: Buffer, contentType: string): Promise<Outcome<string>>;
  getBlob(blobId: string): Promise<Outcome<BlobStoreGetResult>>;
};

export type BlobStoreGetResult = {
  data: Buffer;
  mimeType?: string;
};
