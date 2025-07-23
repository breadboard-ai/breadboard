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
import {
  GoogleDriveClient,
  type DriveFileId,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";

type DriveError = {
  error: {
    code: number;
    message: string;
  };
};

type CavemanCacheEntry = {
  expirationTime: string;
  fileUri: string;
  mimeType: string;
};

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

function success(res: ServerResponse, fileUri: string, mimeType: string) {
  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(
    JSON.stringify({
      part: {
        fileData: { fileUri, mimeType },
      },
    })
  );
  return true;
}

function extractDriveError(s: string): DriveError | null {
  const start = s.indexOf("{");
  try {
    return JSON.parse(s.substring(start));
  } catch {
    return null;
  }
}

export function initializeDriveClient(
  accessToken: string,
  referrer: string | undefined,
  proxyUrl: string | undefined
): GoogleDriveClient {
  return new GoogleDriveClient({
    apiBaseUrl: "https://www.googleapis.com",
    proxyUrl,
    publicApiKey: process.env["VITE_GOOGLE_DRIVE_PUBLIC_API_KEY"] ?? "",
    publicApiSpoofReferer: referrer,
    getUserAccessToken: async () => accessToken,
  });
}

export function makeHandleAssetsDriveRequest({
  googleDriveProxyUrl,
}: {
  googleDriveProxyUrl: string | undefined;
}) {
  return async function handleAssetsDriveRequest(
    req: Request,
    res: Response
  ): Promise<void> {
    const accessToken: string = res.locals.accessToken;
    const driveId: DriveFileId = {
      id: req.params["driveId"] ?? "",
      resourceKey: req.query["resourceKey"] as string | undefined,
    };
    let mimeType = (req.query["mimeType"] as string) ?? "";
    const googleDriveClient = initializeDriveClient(
      accessToken,
      req.headers.referer,
      googleDriveProxyUrl
    );

    const part = CavemanCache.instance().get(driveId.id);
    if (part) {
      success(res, part.fileUri, part.mimeType);
      return;
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (mimeType && !mimeType.startsWith("application/vnd.google-apps.")) {
        const gettingMedia = await googleDriveClient.getFileMedia(driveId);
        if (!gettingMedia.ok) {
          serverError(
            res,
            `Unable to handle asset of type "${mimeType}": ${await gettingMedia.text()}`
          );
          return;
        }
        arrayBuffer = await gettingMedia.arrayBuffer();
      } else {
        mimeType = "application/pdf";

        const exporting = await googleDriveClient.exportFile(driveId, {
          mimeType,
        });
        if (!exporting.ok) {
          serverError(
            res,
            `Unable to handle asset drive request ${await exporting.text()}`
          );
          return;
        }
        arrayBuffer = await exporting.arrayBuffer();
      }

      // TODO: Handle this more memory-efficiently.
      const buffer = Buffer.from(arrayBuffer);
      const readable = Readable.from(buffer);

      const fileApi = new GeminiFileApi();
      const uploading = await fileApi.upload(
        buffer.length,
        mimeType,
        driveId.id,
        readable
      );
      if (!ok(uploading)) {
        serverError(
          res,
          `Unable to handle asset drive request: ${uploading.$error}`
        );
        return;
      }
      CavemanCache.instance().set(driveId.id, {
        fileUri: uploading.fileUri!,
        expirationTime: uploading.expirationTime!,
        mimeType,
      });
      success(res, uploading.fileUri!, mimeType);
    } catch (e) {
      const error = extractDriveError((e as Error).message);
      if (error) {
        serverError(res, error.error.message);
        return;
      }
      serverError(
        res,
        `Unable to handle asset drive request: ${(e as Error).message}`
      );
    }
  };
}
