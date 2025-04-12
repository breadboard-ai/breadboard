/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataPartTransformer,
  err,
  Outcome,
  relativePath,
} from "@google-labs/breadboard";
import {
  FileDataPart,
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { RemoteConnector } from "./types";
import { GoogleDriveToGemini } from "./google-drive-to-gemini";

export { RemotePartTransformer };

type FileInfo = {
  fileUri: string;
};

class RemotePartTransformer implements DataPartTransformer {
  constructor(
    public readonly connector: RemoteConnector,
    public readonly graphUrl: URL
  ) {}

  async persistPart(
    graphUrl: URL,
    part: InlineDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    try {
      const response = await fetch(
        await this.connector.createRequest("blobs", "POST", { parts: [part] })
      );
      if (!response.ok) {
        return err(await response.text());
      }
      const content = (await response.json()) as LLMContent;
      const transformedPart = content.parts.at(0)! as StoredDataCapabilityPart;
      transformedPart.storedData.handle = relativePath(
        graphUrl,
        new URL(transformedPart.storedData.handle)
      );
      return transformedPart;
    } catch (e) {
      return err(`Failed to store blob: ${(e as Error).message}`);
    }
  }

  async toFileData(
    _graphUrl: URL,
    part: StoredDataCapabilityPart | FileDataPart
  ): Promise<Outcome<FileDataPart>> {
    if ("fileData" in part) {
      if (GoogleDriveToGemini.isGoogleDriveDocument(part)) {
        const toGemini = new GoogleDriveToGemini(this.graphUrl, this.connector);
        return toGemini.update(part);
      }
      return part;
    } else {
      const { handle: blobPath, mimeType } = part.storedData;
      const persistedUrl = new URL(blobPath, this.graphUrl);
      persistedUrl.pathname += "/file";
      try {
        const response = await fetch(
          await this.connector.createRequest(persistedUrl.href, "POST")
        );
        if (!response.ok) {
          return err(await response.text());
        }
        const { fileUri } = (await response.json()) as FileInfo;
        return { fileData: { fileUri: fileUri, mimeType } };
      } catch (e) {
        return err(`Failed to get blob file info: ${(e as Error).message}`);
      }
    }
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error("Not implemented");
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    return err("Not implemented");
  }
}
