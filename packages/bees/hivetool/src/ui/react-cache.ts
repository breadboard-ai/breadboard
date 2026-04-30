/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * React source cache and iframe blob URL manager.
 *
 * Fetches React 18 UMD production builds from unpkg once per session,
 * builds the iframe HTML via `buildIframeHtml()`, and creates a single
 * blob URL reused by all `<bees-bundle-frame>` instances.
 */

import { buildIframeHtml } from "../../../common/iframe-runtime.js";

export { getIframeBlobUrl, revokeIframeBlobUrl };

const REACT_CDN =
  "https://unpkg.com/react@18/umd/react.production.min.js";
const REACT_DOM_CDN =
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js";

/** Cached blob URL — shared across all bundle frames in the session. */
let cachedBlobUrl: string | null = null;
let fetchPromise: Promise<string> | null = null;

/**
 * Get (or create) the blob URL for the bundle sandbox iframe.
 *
 * The first call fetches React UMD sources from unpkg and builds
 * the iframe HTML. Subsequent calls return the cached URL immediately.
 */
async function getIframeBlobUrl(): Promise<string> {
  if (cachedBlobUrl) return cachedBlobUrl;

  // Deduplicate concurrent calls — only one fetch in flight.
  if (!fetchPromise) {
    fetchPromise = (async () => {
      const [reactSource, reactDomSource] = await Promise.all([
        fetch(REACT_CDN).then((r) => r.text()),
        fetch(REACT_DOM_CDN).then((r) => r.text()),
      ]);

      const htmlContent = buildIframeHtml(reactSource, reactDomSource);
      const blob = new Blob([htmlContent], { type: "text/html" });
      cachedBlobUrl = URL.createObjectURL(blob);
      return cachedBlobUrl;
    })();
  }

  return fetchPromise;
}

/** Revoke the cached blob URL (e.g., on app teardown). */
function revokeIframeBlobUrl(): void {
  if (cachedBlobUrl) {
    URL.revokeObjectURL(cachedBlobUrl);
    cachedBlobUrl = null;
    fetchPromise = null;
  }
}
