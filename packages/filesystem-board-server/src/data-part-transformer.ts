/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPartTransformer, err, Outcome } from "@google-labs/breadboard";
import {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
  FileDataPart,
} from "../../schema/dist/graph";

export { FileSystemDataPartTransformer };

class FileSystemDataPartTransformer implements DataPartTransformer {
  async persistPart(
    _graphUrl: URL,
    _part: InlineDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    return err(`Not implemented`);
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error(`Not implemented`);
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    return err(`Not implemented`);
  }

  async toFileData(
    _graphUrl: URL,
    _part: StoredDataCapabilityPart | FileDataPart
  ): Promise<Outcome<FileDataPart>> {
    return err(`Not implemented`);
  }
}
