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
      if (asset.metadata?.subType === "gdrive") {
        // Cast needed because `data` is very broadly typed as `NodeValue`.
        const firstPart = (asset.data as LLMContent[])[0]?.parts[0];
        if (firstPart && "fileData" in firstPart) {
          const fileId = firstPart.fileData?.fileUri;
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
      const fileIdMatch = splashHandle?.match(/^drive:\/?(.+)/);
      if (fileIdMatch?.[1]) {
        fileIds.add(fileIdMatch[1]);
      }
    }
  }

  return [...fileIds];
}
