/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GOOGLE_GENAI_API_PREFIX,
  OPAL_BACKEND_API_PREFIX,
} from "./canonical-endpoints.js";

export { geminiApiPrefix };

/**
 * Returns the Gemini API base prefix for model calls.
 *
 * When `enableGeminiBackend` is true, calls are routed through the
 * Opal backend proxy at `/v1beta/models/`. When false (the default),
 * calls go directly to the public Gemini API.
 */
function geminiApiPrefix(enableGeminiBackend: boolean): string {
  return enableGeminiBackend
    ? `${OPAL_BACKEND_API_PREFIX}/v1beta/models`
    : GOOGLE_GENAI_API_PREFIX;
}
