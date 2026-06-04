/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export from shared utils — the canonical location for these pure
// functions. This re-export exists so that action-internal imports don't
// need to reach outside the sca/ tree.
export {
  parsePrompt,
  buildPrompt,
  extractPromptText,
  extractInPorts,
  type ParsedPrompt,
} from "../../../utils/prompt-utils.js";
