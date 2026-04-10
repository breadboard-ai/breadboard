/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppServices } from "../types.js";

export { loadBundleAsync };

/**
 * Fetches the JS (and optional CSS) bundle for a ticket and sends it
 * to the sandboxed iframe via the host communication service.
 *
 * When `slug` is provided (subagent), only files under the slug
 * subdirectory are considered. This prevents loading a sibling
 * agent's bundle from the shared workspace.
 *
 * After rendering, installs a file handler so the iframe can read
 * arbitrary files from the ticket's shared filesystem via
 * `window.opalSDK.readFile(path)`.
 */
async function loadBundleAsync(
  ticketId: string,
  services: AppServices,
  slug?: string | null
): Promise<void> {
  const allFiles = await services.api.listFiles(ticketId);

  // Scope to the agent's slug subdirectory when present.
  const files = slug
    ? allFiles.filter((f) => f.startsWith(slug + "/"))
    : allFiles;

  const jsFile = files.find((f) => f.endsWith(".js"));
  if (!jsFile) {
    console.error(`[load-bundle] No JS file found for ticket ${ticketId} (slug: ${slug ?? "root"})`);
    return;
  }

  const code = await services.api.getFile(ticketId, jsFile);
  if (!code) {
    console.error(
      `[load-bundle] Failed to load ${jsFile} for ticket ${ticketId}`
    );
    return;
  }

  const cssFile = files.find((f) => f.endsWith(".css"));
  const css = cssFile ? await services.api.getFile(ticketId, cssFile) : null;

  await services.hostCommunication.send({
    type: "render",
    code,
    css: css || undefined,
    props: {},
  });

  // Install file handler so the iframe can read files from the
  // ticket's shared filesystem. Paths are NOT scoped by slug —
  // the component can reach any file in the workspace.
  services.hostCommunication.setFileHandler((path) =>
    services.api.getFile(ticketId, path)
  );
}

