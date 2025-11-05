/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardMessage,
  EmbedderMessage,
} from "@breadboard-ai/types/embedder.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";

const ALLOWED_EMBEDDER_ORIGINS =
  // TODO(aomarks) Rename ALLOWED_REDIRECT_ORIGINS to ALLOWED_EMBEDDER_ORIGINS.
  new Set(CLIENT_DEPLOYMENT_CONFIG.ALLOWED_REDIRECT_ORIGINS ?? []);

const UNVERIFIED_EMBEDDER_WINDOW =
  ALLOWED_EMBEDDER_ORIGINS.size && window.self !== window.top
    ? window.top
    : undefined;

export function sendToAllowedEmbedderIfPresent(message: BreadboardMessage) {
  if (UNVERIFIED_EMBEDDER_WINDOW) {
    for (const origin of ALLOWED_EMBEDDER_ORIGINS) {
      UNVERIFIED_EMBEDDER_WINDOW.postMessage(message, origin);
    }
  }
}

export function addMessageEventListenerToAllowedEmbedderIfPresent(
  callback: (message: EmbedderMessage) => void
) {
  if (UNVERIFIED_EMBEDDER_WINDOW) {
    window.addEventListener("message", (event) => {
      if (ALLOWED_EMBEDDER_ORIGINS.has(event.origin)) {
        callback(event.data as EmbedderMessage);
      } else {
        console.warn(
          `[embedded] Dropping message from disallowed origin`,
          event.origin
        );
      }
    });
  }
}
