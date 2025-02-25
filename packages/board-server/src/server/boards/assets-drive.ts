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
import { hasExpired } from "../blobs/file-info.js";
import type { ServerResponse } from "node:http";

type CavemanCacheEntry = { expirationTime: string; fileUri: string };

/**
 * This is the most primivite cache that could be imagined, but it
 * gets the job done for now.
 */
class CavemanCache {
  #map: Map<string, CavemanCacheEntry> = new Map();

  get(driveId: string) {
    const entry = this.#map.get(driveId);
    if (!entry) return;

    if (hasExpired(entry.expirationTime)) {
      this.#map.delete(driveId);
      return;
    }

    return entry;
  }

  set(driveId: string, entry: CavemanCacheEntry) {
    this.#map.set(driveId, entry);
  }

  static #instance: CavemanCache = new CavemanCache();
  static instance() {
    return CavemanCache.#instance;
  }
}

function success(res: ServerResponse, fileUri: string) {
  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(
    JSON.stringify({
      part: {
        fileData: { fileUri, mimeType: "application/pdf" },
      },
    })
  );
  return true;
}

const handleAssetsDriveRequest: ApiHandler = async (parsed, req, res, _) => {
  const args = getConnectionArgs(req);
  if (!ok(args) || !("token" in args)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return true;
  }
  const { id } = parsed as BoardParseResult;

  const part = CavemanCache.instance().get(id!);
  if (part) {
    return success(res, part.fileUri);
  }

  const { token } = args;
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
    CavemanCache.instance().set(id!, {
      fileUri: uploading.fileUri!,
      expirationTime: uploading.expirationTime!,
    });
    return success(res, uploading.fileUri!);
  } catch (e) {
    serverError(
      res,
      `Unable to handle asset drive request: ${(e as Error).message}`
    );
    return true;
  }
};

export default handleAssetsDriveRequest;
