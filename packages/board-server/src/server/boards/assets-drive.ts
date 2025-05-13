/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { ok } from "@google-labs/breadboard";
import { serverError } from "../errors.js";
import { Readable } from "node:stream";
import { GeminiFileApi } from "../blobs/utils/gemini-file-api.js";
import { hasExpired } from "../blobs/file-info.js";
import type { ServerResponse } from "node:http";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";

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

async function handleAssetsDriveRequest(
  req: Request,
  res: Response
): Promise<void> {
  const accessToken: string = res.locals.accessToken;
  const driveId = req.params["driveId"] ?? "";
  const googleDriveClient = new GoogleDriveClient({
    apiBaseUrl: "https://www.googleapis.com",
    proxyUrl:
      "https://staging-appcatalyst.sandbox.googleapis.com/v1beta1/getOpalFile",
    publicApiKey: process.env["VITE_GOOGLE_DRIVE_PUBLIC_API_KEY"] ?? "",
    publicApiSpoofReferer:
      process.env["GOOGLE_DRIVE_PUBLIC_API_SPOOF_REFERER"] ?? "",
    getUserAccessToken: async () => accessToken,
  });

  const part = CavemanCache.instance().get(driveId);
  if (part) {
    success(res, part.fileUri);
    return;
  }

  try {
    const exporting = await googleDriveClient.exportFile(driveId, {
      mimeType: "application/pdf",
    });
    if (!exporting.ok) {
      serverError(
        res,
        `Unable to handle asset drive request ${await exporting.text()}`
      );
      return;
    }

    // TODO: Handle this more memory-efficiently.
    const buffer = Buffer.from(await exporting.arrayBuffer());
    const readable = Readable.from(buffer);

    const fileApi = new GeminiFileApi();
    const uploading = await fileApi.upload(
      buffer.length,
      "application/pdf",
      driveId,
      readable
    );
    if (!ok(uploading)) {
      serverError(
        res,
        `Unable to handle asset drive request: ${uploading.$error}`
      );
      return;
    }
    CavemanCache.instance().set(driveId, {
      fileUri: uploading.fileUri!,
      expirationTime: uploading.expirationTime!,
    });
    success(res, uploading.fileUri!);
  } catch (e) {
    serverError(
      res,
      `Unable to handle asset drive request: ${(e as Error).message}`
    );
  }
}

export default handleAssetsDriveRequest;
