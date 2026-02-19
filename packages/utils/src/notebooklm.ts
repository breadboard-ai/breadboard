/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, LLMContent } from "@breadboard-ai/types";

export const NOTEBOOKLM_MIMETYPE = "application/x-notebooklm";
export const NOTEBOOKLM_TOOL_PATH = "function-group/notebooklm";
export const NOTEBOOKLM_TOOL_TITLE = "NotebookLM";

/** Converts a notebook ID to its full NotebookLM URL */
export function toNotebookLmUrl(id: string): string {
  return `https://notebooklm.google.com/notebook/${id}`;
}

/** Parses a NotebookLM URL and returns the notebook ID, or undefined if not a valid NLM URL */
export function parseNotebookLmId(url: string): string | undefined {
  const prefix = "https://notebooklm.google.com/notebook/";
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  return undefined;
}

/** Checks if a URL is a NotebookLM URL */
export function isNotebookLmUrl(url: string): boolean {
  return url.startsWith("https://notebooklm.google.com/notebook/");
}

export type NotebookAsset = {
  notebookId: string;
};

/**
 * Finds all NotebookLM assets referenced in a graph. Scans `graph.assets` for
 * entries whose `storedData.handle` is a NotebookLM URL.
 */
export function findNotebookAssetsInGraph(
  graph: GraphDescriptor
): NotebookAsset[] {
  const notebooks = new Map<string, NotebookAsset>();

  if (graph.assets) {
    for (const asset of Object.values(graph.assets)) {
      const firstPart = (asset.data as LLMContent[])[0]?.parts?.[0];
      if (firstPart && "storedData" in firstPart) {
        const notebookId = parseNotebookLmId(firstPart.storedData.handle);
        if (notebookId) {
          notebooks.set(notebookId, {
            notebookId,
          });
        }
      }
    }
  }

  return [...notebooks.values()];
}
