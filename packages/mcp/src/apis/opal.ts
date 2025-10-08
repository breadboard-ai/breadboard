/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileDataPart, Outcome } from "@breadboard-ai/types";
import { McpBuiltInClientFactoryContext } from "../types.js";
import { err, ok } from "@breadboard-ai/utils";

export type GoogleDriveToGeminiResponse = {
  part: FileDataPart;
};

export { OpalApi };

class OpalApi {
  constructor(private readonly context: McpBuiltInClientFactoryContext) {}

  async driveIdToFilePart(
    fileId: string,
    mimeType?: string,
    returnStoredData?: boolean,
    resourceKey?: string
  ): Promise<Outcome<FileDataPart>> {
    const url = new URL(
      `/board/boards/@foo/bar/assets/drive/${fileId}`,
      window.location.href
    );
    if (resourceKey) {
      url.searchParams.set("resourceKey", resourceKey);
    }
    if (mimeType) {
      url.searchParams.set("mimeType", mimeType);
    }
    if (returnStoredData) {
      url.searchParams.set("returnStoredData", "true");
    }
    const access_token = await this.context.tokenGetter([
      "https://www.googleapis.com/auth/drive.readonly",
    ]);
    if (!ok(access_token)) {
      return err(access_token.$error);
    }
    try {
      const calling = await this.context.fetchWithCreds(url, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      if (!calling.ok) {
        return err(`Failed to load the Drive file`);
      }
      const result =
        (await calling.json()) as Outcome<GoogleDriveToGeminiResponse>;
      if (!ok(result)) {
        return result;
      }
      return result.part;
    } catch (e) {
      return err((e as Error).message);
    }
  }
}
