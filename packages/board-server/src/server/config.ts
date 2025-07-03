/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AllowFilterFunction } from "@breadboard-ai/types";

export type StorageProvider = "firestore" | "in-memory";

export interface ServerConfig {
  hostname: string;
  port: number;
  storageProvider: StorageProvider;
  /**
   * The public-facing URL of the server, which
   * will be different from the `hostname` when the
   * server is hosted behind a reverse proxy
   * (e.g. Cloud Run or Google App Engine).
   * Overrides the value of the `url` field in the
   * server info API response.
   */
  serverUrl?: string;
  storageBucket?: string;
  proxyServerAllowFilter?: AllowFilterFunction;
  googleDriveProxyUrl: string | undefined;
}
