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

export { GoogleDriveDataPartTransformer };

class GoogleDriveDataPartTransformer implements DataPartTransformer {
  async persistPart(
    _graphUrl: URL,
    _part: InlineDataCapabilityPart,
    temporary: boolean
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    if (temporary) {
      // This is most likely the situation when `blob` capability is called
      // from jsandbox to convert a part into storedData with a temporary url.
      // Use case: creating publicly accessible URls for adding images to
      // documents/slides.
      const msg = `Persisting temporary blobs is not supported with Google Drive backend`;
      console.info(msg);
      return err(msg);
    } else {
      // This is is most likely the situation when a new BGL asset is saved
      // and being persisted.
      const msg = `Persisting assets is not supported with Google Drive backend`;
      console.info(msg);
      return err(msg);
    }
  }

  async toFileData(
    _graphUrl: URL,
    _part: StoredDataCapabilityPart | FileDataPart
  ): Promise<Outcome<FileDataPart>> {
    // Called by ProxyClient.proxy to ensure that parts are correctly turned
    // into handles that Gemini API can understand.
    // There are two kinds:
    // 1) FileDataPart that is a Drive File. These need to be first exported
    //    as PDF, then uploaded using Gemini File API to get the right fileUri.
    // 2) StoredDataCapabilityPart. These need to be uploaded using
    //    Gemini File API to create the right FileDataPart.
    const msg = `Converting to FileData is not supported with Google Drive backend`;
    console.info(msg);
    return err(msg);
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    const msg = `Converting persistent blobs to ephemeral is not supported with Google Drive backend`;
    console.info(msg);
    return err(msg);
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error("Not implemented");
  }
}
