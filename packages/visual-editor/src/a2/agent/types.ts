/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FunctionCallCapabilityPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import type { FunctionDeclaration, GeminiBody } from "../a2/gemini.js";
import type {
  FunctionDefinition,
  StatusUpdateCallback,
} from "./function-definition.js";
import type { SimplifiedToolManager } from "../a2/tool-manager.js";
import type { SpreadsheetValueRange } from "../google-drive/api.js";

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

export type SheetMetadata = {
  name: string;
  columns: string[];
};

export type SheetMetadataWithFilePath = SheetMetadata & {
  file_path: string;
};

/**
 * A generic type of outcome of an agent operation.
 */
export type AgentOutcome = {
  success: boolean;
  error?: string;
};

/**
 * A generic type of managing memory, styled as a Google Sheet.
 */
export type MemoryManager = {
  getSheetMetadata(): Promise<Outcome<{ sheets: SheetMetadataWithFilePath[] }>>;
  readSheet(args: { range: string }): Promise<Outcome<SpreadsheetValueRange>>;
  updateSheet(args: {
    range: string;
    values: string[][];
  }): Promise<Outcome<AgentOutcome>>;
  deleteSheet(args: { name: string }): Promise<Outcome<AgentOutcome>>;
};

export type UIType = "none" | "chat" | "a2ui";

export const VALID_INPUT_TYPES = ["any", "text", "file-upload", "any"] as const;

export type ChatInputType = (typeof VALID_INPUT_TYPES)[number];

export type ChatResponse = {
  input: LLMContent;
};

export type ChatManager = {
  chat(pidginString: string, inputType: string): Promise<Outcome<ChatResponse>>;
};

export type MappedDefinitions = {
  definitions: Map<string, FunctionDefinition>;
  declarations: FunctionDeclaration[];
};

export type FunctionGroup = MappedDefinitions & {
  instruction?: string;
};
