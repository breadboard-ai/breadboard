/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FunctionCallCapabilityPart, LLMContent } from "@breadboard-ai/types";
import { GeminiBody } from "../a2/gemini";

export type AgentProgressManager = {
  /**
   * The agent started execution.
   */
  startAgent(objective: LLMContent): void;

  /**
   * The agent sent initial request.
   */
  sendRequest(model: string, body: GeminiBody): void;

  /**
   * The agent produced a thought.
   */
  thought(text: string): void;

  /**
   * The agent produced a function call.
   */
  functionCall(part: FunctionCallCapabilityPart, description: string): void;

  /**
   * The agent produced a function result.
   */
  functionResult(content: LLMContent): void;

  /**
   * The agent finished executing.
   */
  finish(): void;
};
