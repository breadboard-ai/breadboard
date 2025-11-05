/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BreadboardMessage } from "@breadboard-ai/types/embedder.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";

const ALLOWED_EMBEDDER_ORIGINS =
  // TODO(aomarks) Rename ALLOWED_REDIRECT_ORIGINS to ALLOWED_EMBEDDER_ORIGINS.
  CLIENT_DEPLOYMENT_CONFIG.ALLOWED_REDIRECT_ORIGINS ?? [];

const UNVERIFIED_EMBEDDER_WINDOW =
  ALLOWED_EMBEDDER_ORIGINS.length > 0 && window.self !== window.top
    ? window.top
    : undefined;

export function sendToAllowedEmbedderIfPresent(message: BreadboardMessage) {
  if (UNVERIFIED_EMBEDDER_WINDOW) {
    for (const origin of ALLOWED_EMBEDDER_ORIGINS) {
      UNVERIFIED_EMBEDDER_WINDOW.postMessage(message, origin);
    }
  }
}
