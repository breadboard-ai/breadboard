/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, NodeValue } from "@breadboard-ai/types";
import type { AppController } from "../../controller/controller.js";
import type { AppServices } from "../../services/services.js";
import type { GraphAssetDescriptor } from "../../types.js";

export function parseGoogleDriveUrl(
  urlStr: string
): { id: string; resourceKey?: string } | null {
  try {
    const url = new URL(urlStr);
    if (
      url.hostname !== "docs.google.com" &&
      url.hostname !== "drive.google.com"
    ) {
      return null;
    }

    const resourceKey = url.searchParams.get("resourcekey") || undefined;

    // Check for open?id=...
    if (url.pathname === "/open") {
      const id = url.searchParams.get("id");
      if (id) {
        return { id, resourceKey };
      }
    }

    // Check for /d/FILE_ID/
    const dMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (dMatch) {
      return { id: dMatch[1], resourceKey };
    }

    // Check for /folders/FILE_ID or /folders/d/FILE_ID
    const folderMatch = url.pathname.match(
      /\/folders\/(?:d\/)?([a-zA-Z0-9_-]+)/
    );
    if (folderMatch) {
      return { id: folderMatch[1], resourceKey };
    }

    return null;
  } catch {
    return null;
  }
}

export function parseYouTubeUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    if (
      url.hostname !== "www.youtube.com" &&
      url.hostname !== "youtube.com" &&
      url.hostname !== "youtu.be"
    ) {
      return null;
    }

    // Handle youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      const path = url.pathname.slice(1); // remove leading slash
      const videoId = path.split("/")[0]?.split("?")[0]?.split("&")[0];
      return videoId || null;
    }

    // Handle youtube.com/watch?v=VIDEO_ID
    if (url.pathname === "/watch") {
      return url.searchParams.get("v") || null;
    }

    // Handle youtube.com/embed/VIDEO_ID or youtube.com/shorts/VIDEO_ID
    const match = url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }

    return null;
  } catch {
    return null;
  }
}

export async function processInputText(
  text: string,
  deps: { controller: AppController; services: AppServices }
): Promise<{ processedText: string; error?: string }> {
  // Find all potential URLs in the text
  const urlRegex = /https:\/\/[^\s,;()]+/g;
  const matches = text.match(urlRegex);
  if (!matches) {
    return { processedText: text };
  }

  const { controller, services } = deps;
  const driveClient = services.googleDriveClient;
  const graph = controller.editor?.graph?.graph;

  let processedText = text;

  for (const urlStr of matches) {
    // ─── A. Check Google Drive ───
    const driveParsed = parseGoogleDriveUrl(urlStr);
    if (driveParsed) {
      const { id, resourceKey } = driveParsed;

      // 1. Check readability
      const readable = await driveClient.isReadable({ id, resourceKey });
      if (!readable) {
        return {
          processedText: text,
          error: `I can't seem to access the Google Drive file at ${urlStr}. Please make sure you have access to it.`,
        };
      }

      // 2. Get metadata
      let metadata;
      try {
        metadata = await driveClient.getFileMetadata(
          { id, resourceKey },
          { fields: ["name", "mimeType"] }
        );
      } catch (e) {
        return {
          processedText: text,
          error: `Failed to retrieve metadata for the Google Drive file: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      // 3. Find if already in graph assets to avoid duplicates
      let assetPath: string | null = null;
      if (graph && graph.assets) {
        for (const [path, asset] of Object.entries(graph.assets)) {
          const firstPart = (asset.data as LLMContent[])[0]?.parts?.[0];
          if (
            firstPart &&
            "storedData" in firstPart &&
            firstPart.storedData.handle === `drive:/${id}`
          ) {
            assetPath = path;
            break;
          }
        }
      }

      // 4. Create new asset if not exists
      if (!assetPath) {
        assetPath = `asset-${globalThis.crypto.randomUUID().slice(0, 8)}`;

        const newAsset: GraphAssetDescriptor = {
          metadata: {
            title: metadata.name || "Untitled Google Drive File",
            type: "file",
            subType: metadata.mimeType,
          },
          path: assetPath,
          data: [
            {
              role: "user",
              parts: [
                {
                  storedData: {
                    handle: `drive:/${id}`,
                    mimeType: metadata.mimeType || "application/octet-stream",
                    ...(resourceKey ? { resourceKey } : {}),
                  },
                },
              ],
            },
          ],
        };

        const editor = controller.editor?.graph?.editor;
        if (!editor) {
          return {
            processedText: text,
            error: "No active graph editor available",
          };
        }
        const addResult = await editor.edit(
          [
            {
              type: "addasset",
              path: assetPath,
              data: newAsset.data as unknown as NodeValue,
              metadata: newAsset.metadata,
            },
          ],
          `Adding asset at path "${assetPath}"`
        );
        if (!addResult.success) {
          return {
            processedText: text,
            error: `Failed to add Google Drive file as an asset: ${addResult.error}`,
          };
        }
      }

      // 5. Replace URL with file tag
      processedText = processedText.replace(
        urlStr,
        `<file src="${assetPath}" />`
      );
      continue;
    }

    // ─── B. Check YouTube ───
    const youtubeVideoId = parseYouTubeUrl(urlStr);
    if (youtubeVideoId) {
      // 1. Find if already in graph assets to avoid duplicates
      let assetPath: string | null = null;
      if (graph && graph.assets) {
        for (const [path, asset] of Object.entries(graph.assets)) {
          const firstPart = (asset.data as LLMContent[])[0]?.parts?.[0];
          if (
            firstPart &&
            "fileData" in firstPart &&
            firstPart.fileData.mimeType === "video/mp4" &&
            firstPart.fileData.fileUri === urlStr
          ) {
            assetPath = path;
            break;
          }
        }
      }

      // 2. Create new asset if not exists
      if (!assetPath) {
        assetPath = `asset-${globalThis.crypto.randomUUID().slice(0, 8)}`;

        const newAsset: GraphAssetDescriptor = {
          metadata: {
            title: `YouTube Video`,
            type: "file",
            subType: "youtube",
          },
          path: assetPath,
          data: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: urlStr,
                    mimeType: "video/mp4",
                  },
                },
              ],
            },
          ],
        };

        const editor = controller.editor?.graph?.editor;
        if (!editor) {
          return {
            processedText: text,
            error: "No active graph editor available",
          };
        }
        const addResult = await editor.edit(
          [
            {
              type: "addasset",
              path: assetPath,
              data: newAsset.data as unknown as NodeValue,
              metadata: newAsset.metadata,
            },
          ],
          `Adding asset at path "${assetPath}"`
        );
        if (!addResult.success) {
          return {
            processedText: text,
            error: `Failed to add YouTube video as an asset: ${addResult.error}`,
          };
        }
      }

      // 3. Replace URL with file tag
      processedText = processedText.replace(
        urlStr,
        `<file src="${assetPath}" />`
      );
      continue;
    }
  }

  return { processedText };
}
