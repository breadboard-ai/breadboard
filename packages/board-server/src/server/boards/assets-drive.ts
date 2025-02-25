/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@google-labs/breadboard";
import { getConnectionArgs } from "../auth.js";
import type { ApiHandler, BoardParseResult } from "../types.js";
import { serverError } from "../errors.js";
import { Readable } from "node:stream";
import { GeminiFileApi } from "../blobs/utils/gemini-file-api.js";

const handleAssetsDriveRequest: ApiHandler = async (parsed, req, res, _) => {
  const args = getConnectionArgs(req);
  if (!ok(args) || !("token" in args)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return true;
  }

  const { token } = args;
  const { id } = parsed as BoardParseResult;
  const url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent("application/pdf")}`;

  try {
    const exporting = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!exporting.ok) {
      serverError(
        res,
        `Unable to handle asset drive request ${await exporting.text()}`
      );
      return true;
    }

    // TODO: Handle this more memory-efficiently.
    const buffer = Buffer.from(await exporting.arrayBuffer());
    const readable = Readable.from(buffer);

    const fileApi = new GeminiFileApi();
    const uploading = await fileApi.upload(
      buffer.length,
      "application/pdf",
      id!,
      readable
    );
    if (!ok(uploading)) {
      serverError(
        res,
        `Unable to handle asset drive request: ${uploading.$error}`
      );
      return true;
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        part: {
          fileData: { fileUri: uploading.fileUri, mimeType: "application/pdf" },
        },
      })
    );
    return true;
  } catch (e) {
    serverError(
      res,
      `Unable to handle asset drive request: ${(e as Error).message}`
    );
    return true;
  }
};

export default handleAssetsDriveRequest;
