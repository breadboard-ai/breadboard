/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import { createFetchWithCreds, ok } from "@breadboard-ai/utils";
import { serverError } from "../errors.js";
import { Readable } from "node:stream";
import { GeminiFileApi } from "../blobs/utils/gemini-file-api.js";
import type { ServerResponse } from "node:http";
import {
  GoogleDriveClient,
  type DriveFileId,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { GoogleStorageBlobStore } from "../blob-store.js";

const GCS_BLOB_LIFETIME_IN_MS = 7 * 24 * 60 * 60 * 1000;

type DriveError = {
  error: {
    code: number;
    message: string;
  };
};

type Mode = "file" | "blob";

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

function successBlob(
  res: ServerResponse,
  blobId: string,
  mimeType: string,
  serverUrl: string
) {
  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(
    JSON.stringify({
      part: {
        storedData: {
          handle: `${serverUrl}/blobs/${blobId}`,
          mimeType,
        },
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

export function makeHandleAssetsDriveRequest(
  bucketId?: string,
  serverUrl?: string
) {
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
    let mode = req.query["mode"] as Mode;
    if (!["file", "blob"].includes(mode)) mode = "file";

    const googleDriveClient = new GoogleDriveClient({
      fetchWithCreds: createFetchWithCreds(async () => accessToken),
    });

    const part = GeminiFileApi.cache().get(driveId.id, mode);
    if (part) {
      if (mode === "file") {
        success(res, part.fileUri, part.mimeType);
      } else {
        successBlob(res, part.fileUri!, part.mimeType!, serverUrl!);
      }
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
      if (mode === "file") {
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
        GeminiFileApi.cache().set(driveId.id, mode, {
          fileUri: uploading.fileUri!,
          expirationTime: uploading.expirationTime!,
          mimeType,
        });
        success(res, uploading.fileUri!, mimeType);
      } else if (mode === "blob") {
        if (!bucketId) {
          serverError(
            res,
            `Unable to save to blob store: Bucket Id is not configured`
          );
          return;
        }
        if (!serverUrl) {
          serverError(
            res,
            `Unable to save to blob store: Server URL is not configured`
          );
          return;
        }
        const blobStore = new GoogleStorageBlobStore(bucketId);
        const blobId = await blobStore.saveBuffer(buffer, mimeType);
        if (!ok(blobId)) {
          serverError(res, `Unable to save to blob store: ${blobId.$error}`);
          return;
        }
        GeminiFileApi.cache().set(driveId.id, mode, {
          fileUri: blobId,
          expirationTime: new Date(
            Date.now() + GCS_BLOB_LIFETIME_IN_MS
          ).toISOString(),
          mimeType,
        });
        successBlob(res, blobId, mimeType, serverUrl);
      } else {
        serverError(res, `Unknown mode: ${mode}`);
        return;
      }
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
