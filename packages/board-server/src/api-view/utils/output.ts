/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LLMFunctionCall,
  LLMFunctionResponse,
  LLMInlineData,
  LLMPart,
  LLMStoredData,
  LLMText,
} from "../types.js";

export function isText(part: LLMPart): part is LLMText {
  return "text" in part;
}

export function isFunctionCall(part: LLMPart): part is LLMFunctionCall {
  return "functionCall" in part;
}

export function isFunctionResponse(part: LLMPart): part is LLMFunctionResponse {
  return "functionResponse" in part;
}

export function isInlineData(part: LLMPart): part is LLMInlineData {
  return "inlineData" in part;
}

export function isStoredData(part: LLMPart): part is LLMStoredData {
  return "storedData" in part;
}
