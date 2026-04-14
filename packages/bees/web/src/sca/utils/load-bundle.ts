/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppServices } from "../types.js";

export { loadBundleAsync };

/**
 * Fetches the resolved JS (and optional CSS) bundle for an agent
 * from the server and sends it to the sandboxed iframe via the host
 * communication service.
 *
 * After rendering, installs a file handler so the iframe can read
 * arbitrary files from the agent's shared filesystem via
 * `window.opalSDK.readFile(path)`.
 */
async function loadBundleAsync(
  agentId: string,
  services: AppServices,
  slug?: string | null
): Promise<void> {
  const bundle = await services.api.getBundle(agentId, slug);
  if (!bundle) {
    console.error(
      `[load-bundle] No bundle found for agent ${agentId} (slug: ${slug ?? "root"})`
    );
    return;
  }

  await services.hostCommunication.send({
    type: "render",
    code: bundle.js,
    css: bundle.css || undefined,
    props: {},
  });

  // Install file handler so the iframe can read files from the
  // agent's shared filesystem. Paths are NOT scoped by slug —
  // the component can reach any file in the workspace.
  services.hostCommunication.setFileHandler((path) =>
    services.api.getFile(agentId, path)
  );
}
