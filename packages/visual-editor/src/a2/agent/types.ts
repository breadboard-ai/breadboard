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
  StatusUpdateCallbackOptions,
} from "./function-definition.js";
import type { SimplifiedToolManager } from "../a2/tool-manager.js";
import type { SpreadsheetValueRange } from "../google-drive/api.js";
import type { ErrorMetadata } from "../a2/utils.js";
import type { ServerToClientMessage } from "../../a2ui/0.8/types/types.js";
import type { AgentFileSystem } from "./file-system.js";
import type { PidginTranslator } from "./pidgin-translator.js";
import type { AgentUI } from "./ui.js";
import type { Params } from "../a2/common.js";

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
  appendToSheet(
    context: NodeHandlerContext,
    args: { range: string; values: string[][] }
  ): Promise<Outcome<AgentOutcome>>;
  ensureSystemSheet(
    context: NodeHandlerContext,
    name: string,
    columns: string[]
  ): Promise<Outcome<AgentOutcome>>;
};

export type UIType = "chat" | "a2ui" | "simulated";

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
 * Dependencies that the configurator receives to build function groups.
 * These are created by the caller — not by the Loop.
 */
export type LoopDeps = {
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  ui: AgentUI;
};

/**
 * Configuration flags the configurator uses to decide which function
 * groups to include and how to wire them.
 */
export type FunctionGroupConfiguratorFlags = {
  uiType: UIType;
  useMemory: boolean;
  useNotebookLM: boolean;
  objective: LLMContent;
  uiPrompt?: LLMContent;
  params: Params;
  onSuccess: (href: string, pidginString: string) => Promise<Outcome<void>>;
  onFailure: (message: string) => void;
};

/**
 * A function that builds the set of function groups for an agent run.
 * The caller creates deps and flags, invokes this function, and passes
 * the resulting groups to the Loop.
 */
export type FunctionGroupConfigurator = (
  deps: LoopDeps,
  flags: FunctionGroupConfiguratorFlags
) => Promise<Outcome<FunctionGroup[]>>;

/**
 * Optional lifecycle hooks the Loop invokes at key points.
 * Each agent type opts in to whichever hooks it needs.
 *
 * - A full-featured content generation agent provides all hooks
 *   (progress UI, run state tracking, A2UI surfaces).
 * - A lightweight graph-editing agent may provide none.
 * - A headless eval agent may provide only run-state hooks.
 */
export type LoopHooks = {
  /**
   * Called once before the loop begins.
   * Use for setup: initializing progress UI, starting run state tracking.
   */
  onStart?(objective: LLMContent): void;

  /**
   * Called once after the loop ends (success or failure).
   * Use for cleanup: closing progress UI, finalizing run state.
   */
  onFinish?(): void;

  /**
   * Called each time Gemini returns a content chunk.
   * Use for run state tracking (content persistence).
   */
  onContent?(content: LLMContent): void;

  /**
   * Called when the model produces a thought.
   * Use for progress UI (showing agent reasoning).
   */
  onThought?(text: string): void;

  /**
   * Called when the model produces a function call.
   * Use for progress UI (showing function call status).
   * Returns a callId and optional reporter for nested progress.
   */
  onFunctionCall?(
    part: FunctionCallCapabilityPart,
    icon?: string,
    title?: string
  ): { callId: string; reporter: ProgressReporter | null };

  /**
   * Called when a function call produces a status update.
   * Use for progress UI (updating function call status).
   */
  onFunctionCallUpdate?(
    callId: string,
    status: string | null,
    opts?: StatusUpdateCallbackOptions
  ): void;

  /**
   * Called when a function call produces a result.
   * Use for progress UI (showing function call results).
   */
  onFunctionResult?(callId: string, content: LLMContent): void;

  /**
   * Called when a complete turn finishes (request + function results).
   * Use for run state tracking (incrementing turn index).
   */
  onTurnComplete?(): void;

  /**
   * Called when the request body is sent to Gemini.
   * Use for run state tracking (capturing the first request).
   */
  onSendRequest?(model: string, body: GeminiBody): void;
};

/**
 * Combines multiple LoopHooks into one, fanning out each call to all
 * providers. For hooks that return values (`onFunctionCall`), the first
 * provider that defines the hook wins.
 */
export function mergeHooks(...hookSets: LoopHooks[]): LoopHooks {
  return {
    onStart(objective) {
      hookSets.forEach((h) => h.onStart?.(objective));
    },
    onFinish() {
      hookSets.forEach((h) => h.onFinish?.());
    },
    onContent(content) {
      hookSets.forEach((h) => h.onContent?.(content));
    },
    onThought(text) {
      hookSets.forEach((h) => h.onThought?.(text));
    },
    onFunctionCall(part, icon?, title?) {
      for (const h of hookSets) {
        if (h.onFunctionCall) return h.onFunctionCall(part, icon, title);
      }
      // Fallback: generate an ID but no reporter
      return { callId: crypto.randomUUID(), reporter: null };
    },
    onFunctionCallUpdate(callId, status, opts?) {
      hookSets.forEach((h) => h.onFunctionCallUpdate?.(callId, status, opts));
    },
    onFunctionResult(callId, content) {
      hookSets.forEach((h) => h.onFunctionResult?.(callId, content));
    },
    onTurnComplete() {
      hookSets.forEach((h) => h.onTurnComplete?.());
    },
    onSendRequest(model, body) {
      hookSets.forEach((h) => h.onSendRequest?.(model, body));
    },
  };
}

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
