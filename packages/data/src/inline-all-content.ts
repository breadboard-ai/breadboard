/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  NodeValue,
  Outcome,
  OutputValues,
} from "@breadboard-ai/types";
import { asBase64, isLLMContentArray, transformDataParts } from "./common.js";
import { err, ok } from "@breadboard-ai/utils";

export { inlineAllContent };

async function inlineHtmlBlobUrls(html: string): Promise<string> {
  const blobUrls = findBlobUrlsInHtml(html);
  if (blobUrls.length === 0) {
    return html;
  }

  const replacements = (
    await Promise.all(
      blobUrls.map(async ({ start, end, blobId }) => {
        // Let's not trust the raw URL. We instead extract the blob ID from the
        // URL if it looks like a blob URL, and then construct a new safe blob
        // URL from scratch. This way there is no way for generated HTML to
        // trigger an unsafe fetch.
        const safeUrl = new URL(
          `/board/blobs/${encodeURIComponent(blobId)}`,
          document.location.origin
        );
        const response = await fetch(safeUrl);
        if (!response.ok) {
          console.error(
            `${response.status} error fetching blob`,
            safeUrl,
            await response.text()
          );
          return null;
        }
        const blob = await response.blob();
        const base64 = await asBase64(blob);
        const dataUrl = `data:${blob.type};base64,${base64}`;
        return { start, end, replacement: dataUrl };
      })
    )
  ).filter((replacement) => replacement != null);

  // Apply replacements reverse so that indices remain correct.
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    html = html.slice(0, start) + replacement + html.slice(end);
  }
  return html;
}

function findBlobUrlsInHtml(
  str: string
): Array<{ start: number; end: number; blobId: string }> {
  const results = [];
  const matches = str.matchAll(/https?:\/\/[^/]+\/board\/blobs\/([a-z0-9-]+)/g);
  for (const match of matches) {
    results.push({
      start: match.index,
      end: match.index + match[0].length,
      blobId: match[1],
    });
  }
  return results;
}

async function inlineAllContent(
  boardServer: BoardServer,
  outputs: OutputValues,
  shareableGraphUrl: string
): Promise<Outcome<OutputValues>> {
  const finalOutputValues = structuredClone(outputs);
  if (!boardServer.dataPartTransformer) {
    return err(`Board Server does not support data part transformation`);
  }
  const errors: { $error: string }[] = [];
  await Promise.all(
    Object.entries(finalOutputValues).map(async ([key, value]) => {
      if (!isLLMContentArray(value)) {
        return;
      }

      // Transform any inline data parts.
      const inlined = await transformDataParts(
        new URL(shareableGraphUrl),
        value,
        "inline",
        boardServer.dataPartTransformer!(new URL(shareableGraphUrl))
      );
      if (!ok(inlined)) {
        console.error(`Error inlining results content for ${key}`, inlined);
        errors.push(inlined);
        return;
      }

      // Also check for blobs inside of HTML, and inline those too.
      for (const content of inlined) {
        for (const part of content.parts) {
          if (
            "inlineData" in part &&
            part.inlineData.mimeType === "text/html" &&
            part.inlineData.data
          ) {
            const html = part.inlineData.data;
            part.inlineData.data = await inlineHtmlBlobUrls(html);
          }
        }
      }

      finalOutputValues[key] = inlined as NodeValue;
    })
  );
  if (errors.length > 0) {
    return errors[0];
  }
  return finalOutputValues;
}
