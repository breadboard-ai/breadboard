/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileDataPart } from "@breadboard-ai/types";
import { RemoteConnector } from "./types";
import { err, ok, Outcome } from "@google-labs/breadboard";

export { GoogleDriveToGemini };

export type GoogleDriveToGeminiResponse = {
  part: FileDataPart;
};

class GoogleDriveToGemini {
  static isGoogleDriveDocument(part: FileDataPart) {
    return part.fileData.mimeType.startsWith("application/vnd.google-apps.");
  }

  constructor(
    public readonly graphUrl: URL,
    public readonly connector: RemoteConnector
  ) {}

  async update(part: FileDataPart): Promise<Outcome<FileDataPart>> {
    try {
      const { fileUri: driveId } = part.fileData;
      const path = `${this.graphUrl.href}/assets/drive/${driveId}`;
      const updating = await fetch(
        await this.connector.createRequest(path, "POST", { part })
      );
      if (!updating.ok) {
        return err(await updating.text());
      }
      const updated =
        (await updating.json()) as Outcome<GoogleDriveToGeminiResponse>;
      if (!ok(updated)) return updated;
      return updated.part;
    } catch (e) {
      return err((e as Error).message);
    }
    return part;
  }
}
