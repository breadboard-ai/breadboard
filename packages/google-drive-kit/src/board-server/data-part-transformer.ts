/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileDataPart,
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import {
  err,
  type DataPartTransformer,
  type Outcome,
} from "@google-labs/breadboard";
import type { DriveOperations } from "./operations.js";

export { GoogleDriveDataPartTransformer };

export type GoogleDriveToGeminiResponse = {
  part: FileDataPart;
};

class GoogleDriveDataPartTransformer implements DataPartTransformer {
  constructor(private readonly ops: DriveOperations) {}

  async persistPart(
    _graphUrl: URL,
    part: InlineDataCapabilityPart | StoredDataCapabilityPart,
    temporary: boolean
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    if (temporary) {
      // This is most likely the situation when `blob` capability is called
      // from jsandbox to convert a part into storedData with a temporary url.
      // Use case: creating publicly accessible URls for adding images to
      // documents/slides.
      const msg = `Persisting temporary blobs is not supported with Google Drive backend`;
      console.debug(msg);
      return err(msg);
    } else {
      const result = await this.ops.saveDataPart(part);
      return result;
    }
  }

  async toFileData(): Promise<Outcome<FileDataPart>> {
    const msg = `This code path should never be travelled.`;
    console.debug(msg);
    return err(msg);
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    const msg = `Converting persistent blobs to ephemeral is not supported with Google Drive backend`;
    console.debug(msg);
    return err(msg);
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error("Not implemented");
  }
}
