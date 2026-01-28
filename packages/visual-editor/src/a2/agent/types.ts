/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FunctionCallCapabilityPart,
  LLMContent,
  NodeHandlerContext,
  Outcome,
} from "@breadboard-ai/types";
import type { FunctionDeclaration, GeminiBody } from "../a2/gemini.js";
import type {
  FunctionDefinition,
  StatusUpdateCallback,
} from "./function-definition.js";
import type { SimplifiedToolManager } from "../a2/tool-manager.js";
import type { SpreadsheetValueRange } from "../google-drive/api.js";

export type FileDescriptor = {
  type: "text" | "storedData" | "inlineData" | "fileData";
  mimeType: string;
  data: string;
  title?: string;
  resourceKey?: string;
};

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

export type ReadSheetOutcome = SpreadsheetValueRange | { error: string };

/**
 * A generic type of managing memory, styled as a Google Sheet.
 */
export type MemoryManager = {
  createSheet(
    context: NodeHandlerContext,
    args: SheetMetadata
  ): Promise<Outcome<AgentOutcome>>;
  getSheetMetadata(
    context: NodeHandlerContext
  ): Promise<Outcome<{ sheets: SheetMetadataWithFilePath[] }>>;
  readSheet(
    context: NodeHandlerContext,
    args: { range: string }
  ): Promise<Outcome<ReadSheetOutcome>>;
  updateSheet(
    context: NodeHandlerContext,
    args: { range: string; values: string[][] }
  ): Promise<Outcome<AgentOutcome>>;
  deleteSheet(
    context: NodeHandlerContext,
    args: { name: string }
  ): Promise<Outcome<AgentOutcome>>;
};

export type UIType = "chat" | "a2ui";

export const VALID_INPUT_TYPES = ["any", "text", "file-upload"] as const;

export type ChatInputType = (typeof VALID_INPUT_TYPES)[number];

export type ChatResponse = {
  input: LLMContent;
};

export type ChatManager = {
  chat(pidginString: string, inputType: string): Promise<Outcome<ChatResponse>>;
};

export type MappedDefinitions = {
  definitions: [string, FunctionDefinition][];
  declarations: FunctionDeclaration[];
};

export type FunctionGroup = MappedDefinitions & {
  instruction?: string;
};

/**
 * Status of an agent loop run.
 */
export type RunStatus = "running" | "failed" | "completed";

/**
 * Stored state of an agent loop run, used for resume and trace download.
 */
export type RunState = {
  id: string;
  status: RunStatus;
  startTime: number;
  endTime?: number;
  contents: LLMContent[];
  /** The model name used for this run */
  model?: string;
  /** The full request body sent to Gemini (captured after first request) */
  requestBody?: GeminiBody;
  lastCompleteTurnIndex: number;
  error?: string;
  /** The original objective for this run */
  objective: LLMContent;
  /** Files created/used during the run (from AgentFileSystem) */
  files: Record<string, FileDescriptor>;
  /** Whether this run can be resumed (set to false when graph is edited) */
  resumable: boolean;
};
