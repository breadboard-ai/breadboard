/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, LLMContent } from "@breadboard-ai/types";

export function findGoogleDriveAssetsInGraph(graph: GraphDescriptor): string[] {
  if (!graph.assets) {
    return [];
  }
  // Use a set because there can be duplicates.
  const fileIds = new Set<string>();
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
  return [...fileIds];
}
