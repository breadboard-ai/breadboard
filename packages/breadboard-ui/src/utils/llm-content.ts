/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LLMFunctionCall,
  LLMFunctionResponse,
  LLMInlineData,
  LLMPart,
  LLMText,
} from "../types/types.js";

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
