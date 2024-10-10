/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ViteDevServer } from "vite";

export interface ServerConfig {
  allowedOrigins: Set<string>;
  hostname: string;
  viteDevServer: ViteDevServer | null;
  rootPath: string;
  storageBucket?: string;
}
