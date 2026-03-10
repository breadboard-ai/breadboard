/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OPAL_BACKEND_API_PREFIX,
} from "./canonical-endpoints.js";

export { geminiApiPrefix };

/**
 * Returns the Gemini API base prefix for model calls.
 *
 * Calls are routed through the Opal backend proxy at `/v1beta1/models/`.
 */
function geminiApiPrefix(): string {
  return `${OPAL_BACKEND_API_PREFIX}/v1beta1/models`;
}
