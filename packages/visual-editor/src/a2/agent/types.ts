/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  LLMContent,
  NodeHandlerContext,
  Outcome,
} from "@breadboard-ai/types";
import type { FunctionDeclaration, GeminiBody } from "../a2/gemini.js";
import type { streamGenerateContent, conformGeminiBody } from "../a2/gemini.js";
import type { callGeminiImage } from "../a2/image-utils.js";
import type { callVideoGen } from "../video-generator/main.js";
import type { callAudioGen } from "../audio-generator/main.js";
import type { callMusicGen } from "../music-generator/main.js";
import type {
  FunctionDefinition,
  StatusUpdateCallback,
} from "./function-definition.js";
import type { SimplifiedToolManager } from "../a2/tool-manager.js";
import type { SpreadsheetValueRange } from "../google-drive/api.js";
import type { ErrorMetadata } from "../a2/utils.js";
import type { ServerToClientMessage } from "../../a2ui/0.8/types/types.js";

/**
 * Interface for reporting step execution progress.
 * This is used by executeStep to log step input/output and errors.
 */
export type ProgressReporter = {
  addJson(title: string, data: unknown, icon?: string): void;
  addError(error: { $error: string; metadata?: ErrorMetadata }): {
    $error: string;
    metadata?: ErrorMetadata;
  };
  finish(): void;
};

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
    callId: string,
    part: FunctionCallCapabilityPart,
    statusUpdateCallback: StatusUpdateCallback,
    reporter: ProgressReporter | null
  ): void;
  getResults(): Promise<
    Outcome<{
      combined: LLMContent;
      results: { callId: string; response: FunctionResponseCapabilityPart }[];
    } | null>
  >;
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
   * Returns a unique ID for matching with the corresponding function result,
   * and a reporter for progress updates scoped to this function call.
   */
  functionCall(
    part: FunctionCallCapabilityPart,
    icon?: string,
    title?: string
  ): { callId: string; reporter: ProgressReporter | null };

  /**
   * The agent produced a function result.
   * @param callId - ID from the corresponding functionCall
   * @param content - The result content
   */
  functionResult(callId: string, content: LLMContent): void;

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

export type ChatChoice = {
  id: string;
  label: string;
};

export type ChatChoiceSelectionMode = "single" | "multiple";

/**
 * Layout options for presenting choices:
 * - "list": Vertical stack (default) - best for longer choice labels
 * - "row": Horizontal inline - best for short choices like "Yes/No"
 * - "grid": Wrapping grid - adapts to available space
 */
export type ChatChoiceLayout = "list" | "row" | "grid";

export type ChatChoicesResponse = {
  selected: string[];
};

export type ChatManager = {
  chat(pidginString: string, inputType: string): Promise<Outcome<ChatResponse>>;
  presentChoices(
    message: string,
    choices: ChatChoice[],
    selectionMode: ChatChoiceSelectionMode,
    layout?: ChatChoiceLayout,
    noneOfTheAboveLabel?: string
  ): Promise<Outcome<ChatChoicesResponse>>;
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
  /** Absolute timestamp when run started (Date.now()) */
  startTime: number;
  /** Absolute timestamp when run ended (Date.now()) */
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
  /** A2UI surfaces rendered during the run (one entry per renderUserInterface call) */
  a2uiSurfaces: ServerToClientMessage[][];
};

/**
 * Injectable generators for testability.
 * Production code uses real implementations; tests inject mocks.
 */
export type Generators = {
  streamContent: typeof streamGenerateContent;
  conformBody: typeof conformGeminiBody;
  callImage: typeof callGeminiImage;
  callVideo: typeof callVideoGen;
  callAudio: typeof callAudioGen;
  callMusic: typeof callMusicGen;
};
