/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, LLMContent } from "@breadboard-ai/types";

export function findGoogleDriveAssetsInGraph(graph: GraphDescriptor): string[] {
  // Use a set because there can be duplicates.
  const fileIds = new Set<string>();

  if (graph.assets) {
    for (const asset of Object.values(graph.assets)) {
      // Cast needed because `data` is very broadly typed as `NodeValue`.
      const firstPart = (asset.data as LLMContent[])[0]?.parts[0];
      if (firstPart) {
        if ("fileData" in firstPart && asset.metadata?.subType === "gdrive") {
          const fileId = firstPart.fileData?.fileUri;
          if (fileId) {
            fileIds.add(fileId);
          }
        }
        if ("storedData" in firstPart) {
          const fileId = extractDriveFileId(firstPart.storedData.handle);
          if (fileId) {
            fileIds.add(fileId);
          }
        }
      }
    }
  }

  // Theme splash images are not listed in assets.
  const themes = graph.metadata?.visual?.presentation?.themes;
  if (themes) {
    for (const theme of Object.values(themes)) {
      const splashHandle = theme.splashScreen?.storedData?.handle;
      if (splashHandle) {
        const fileId = extractDriveFileId(splashHandle);
        if (fileId) {
          fileIds.add(fileId);
        }
      }
    }
  }

  return [...fileIds];
}

function extractDriveFileId(str: string): string | null {
  return str.match(/^drive:\/?(.+)/)?.[1] ?? null;
}
