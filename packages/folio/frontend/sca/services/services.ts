/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppEnvironment } from "../environment/environment.js";

/**
 * The services layer for Folio.
 * Reduced to the bare minimum.
 */
export interface AppServices {
  fetchWithCreds: typeof fetch;
}

let instance: AppServices | null = null;

export function services(_env: AppEnvironment) {
  if (!instance) {
    instance = {
      fetchWithCreds: fetch.bind(window),
    } satisfies AppServices;
  }
  return instance;
}
