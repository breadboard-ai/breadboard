/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FunctionCallCapabilityPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { GeminiBody } from "../a2/gemini";
import {
  FunctionDefinition,
  StatusUpdateCallback,
} from "./function-definition";
import { SimplifiedToolManager } from "../a2/tool-manager";

export type FunctionCallerFactory = {
  create(
    builtIn: Map<string, FunctionDefinition>,
    custom: SimplifiedToolManager
  ): FunctionCaller;
};

export type FunctionCaller = {
  call(
    part: FunctionCallCapabilityPart,
    statusUpdateCallback: StatusUpdateCallback
  ): void;
  getResults(): Promise<Outcome<LLMContent | null>>;
};

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

export type A2UIRenderer = {
  /**
   * Presents the UI, then waits until the user responds and returns the
   * action context object.
   */
  render(a2UIPayload: unknown[]): Promise<Outcome<Record<string, unknown>>>;
};
