/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bundle Mapper — converts parsed multipart parts into a ViewBundle.
 *
 * Separates parts into three categories:
 * - JSX files → kept as source text in the files map
 * - CSS files → kept as source text in the files map
 * - Assets (SVG, images, etc.) → blob URLs (or passthrough URLs when
 *   the backend provides them directly)
 *
 * The import resolution is handled downstream by esbuild's build API
 * with virtual module plugins — no import rewriting happens here.
 */

import type { ViewBundle } from "../types.js";
import { type BundlePart } from "./multipart.js";

export { mapPartsToBundle };

/**
 * Map parsed multipart parts into a ViewBundle ready for the iframe pipeline.
 */
function mapPartsToBundle(runId: string, parts: BundlePart[]): ViewBundle {
  const files: Record<string, string> = {};
  const assets: Record<string, { type: string; url: string }> = {};

  for (const part of parts) {
    const text = new TextDecoder().decode(part.body);

    if (part.filename.endsWith(".jsx") || part.filename.endsWith(".css")) {
      files[part.filename] = text;
    } else if (part.filename === "SKILL.md") {
      // Skip the manifest — we don't need it in the bundle.
    } else {
      // Asset: create a blob URL.
      // When the backend provides plain URLs instead, this becomes a
      // passthrough — just use the URL directly.
      const blob = new Blob([part.body as unknown as BlobPart], {
        type: part.contentType,
      });
      assets[part.filename] = {
        type: part.contentType,
        url: URL.createObjectURL(blob),
      };
    }
  }

  return {
    id: runId,
    views: [
      {
        id: "main",
        label: "Generated UI",
        files,
        props: {},
      },
    ],
    assets,
  };
}
