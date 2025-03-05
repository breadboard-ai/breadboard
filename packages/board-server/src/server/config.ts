/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ViteDevServer } from "vite";

export interface ServerConfig {
  allowedOrigins: string[];
  hostname: string;
  port: number;
  /**
   * The public-facing URL of the server, which
   * will be different from the `hostname` when the
   * server is hosted behind a reverse proxy
   * (e.g. Cloud Run or Google App Engine).
   * Overrides the value of the `url` field in the
   * server info API response.
   */
  serverUrl?: string;
  viteDevServer: ViteDevServer | null;
  rootPath: string;
  storageBucket?: string;
}
