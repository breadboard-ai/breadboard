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
 */
async function loadBundleAsync(
  ticketId: string,
  services: AppServices
): Promise<void> {
  const files = await services.api.listFiles(ticketId);

  const jsFile = files.find((f) => f.endsWith(".js"));
  if (!jsFile) {
    console.error(`[load-bundle] No JS file found for ticket ${ticketId}`);
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
    assets: {},
  });
}
