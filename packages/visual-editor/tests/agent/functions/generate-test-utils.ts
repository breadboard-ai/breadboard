/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mock } from "node:test";
import type { Outcome, LLMContent, DataPart } from "@breadboard-ai/types";
import type {
  Generators,
  MappedDefinitions,
} from "../../../src/a2/agent/types.js";
import type { GenerateFunctionArgs } from "../../../src/a2/agent/functions/generate.js";
import type { AgentFileSystem } from "../../../src/a2/agent/file-system.js";
import type { PidginTranslator } from "../../../src/a2/agent/pidgin-translator.js";
import type { TaskTreeManager } from "../../../src/a2/agent/task-tree-manager.js";
import type { StatusUpdateCallback } from "../../../src/a2/agent/function-definition.js";
import type {
  GeminiAPIOutputs,
  Candidate,
  GroundingMetadata,
} from "../../../src/a2/a2/gemini.js";
import { stubModuleArgs } from "../../useful-stubs.js";
import type { AgentEventSink } from "../../../src/a2/agent/agent-event-sink.js";
import type { AgentEvent } from "../../../src/a2/agent/agent-event.js";

export {
  createMockGenerators,
  createStreamResponse,
  createMockFileSystem,
  createMockTaskTreeManager,
  createMockTranslator,
  createMockSink,
  createTestArgs,
  createMockStatusUpdater,
  getHandler,
  fixtures,
  createCandidate,
};

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Creates a valid Candidate with required fields.
 */
function createCandidate(parts: LLMContent["parts"]): Candidate {
  return {
    content: { parts, role: "model" },
    tokenOutput: 0,
    groundingMetadata: {} as GroundingMetadata,
  };
}

// ============================================================================
// Fixtures
// ============================================================================

const fixtures = {
  textStreamSuccess: {
    candidates: [createCandidate([{ text: "Generated text response" }])],
  } as GeminiAPIOutputs,
  textStreamWithThought: {
    candidates: [
      createCandidate([
        { text: "Thinking about this...", thought: true },
        { text: "Final answer" },
      ]),
    ],
  } as GeminiAPIOutputs,
  codeExecutionSuccess: {
    candidates: [
      createCandidate([
        { text: "Result: 42" },
        { codeExecutionResult: { outcome: "OUTCOME_OK", output: "42" } },
      ]),
    ],
  } as GeminiAPIOutputs,
  codeExecutionError: {
    candidates: [
      createCandidate([
        {
          codeExecutionResult: {
            outcome: "OUTCOME_FAILED",
            output: "SyntaxError",
          },
        },
      ]),
    ],
  } as GeminiAPIOutputs,
  imageSuccess: [
    {
      parts: [{ inlineData: { mimeType: "image/png", data: "base64data" } }],
      role: "model" as const,
    },
  ] as LLMContent[],
  multiImageSuccess: [
    {
      parts: [
        { inlineData: { mimeType: "image/png", data: "img1" } },
        { inlineData: { mimeType: "image/png", data: "img2" } },
      ],
      role: "model" as const,
    },
  ] as LLMContent[],
  videoSuccess: {
    parts: [{ storedData: { handle: "video-handle", mimeType: "video/mp4" } }],
    role: "model" as const,
  } as LLMContent,
  audioSuccess: {
    parts: [{ storedData: { handle: "audio-handle", mimeType: "audio/wav" } }],
    role: "model" as const,
  } as LLMContent,
  musicSuccess: {
    parts: [{ storedData: { handle: "music-handle", mimeType: "audio/wav" } }],
    role: "model" as const,
  } as LLMContent,
  emptyStream: {
    candidates: [createCandidate([])],
  } as GeminiAPIOutputs,
};

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates an async iterable for streaming responses.
 */
function createStreamResponse(
  chunks: GeminiAPIOutputs[]
): AsyncIterable<GeminiAPIOutputs> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

/**
 * Creates a mock Generators object with optional overrides.
 */
function createMockGenerators(overrides: Partial<Generators> = {}): Generators {
  return {
    streamContent:
      overrides.streamContent ??
      (mock.fn(async () =>
        createStreamResponse([fixtures.textStreamSuccess])
      ) as unknown as Generators["streamContent"]),
    conformBody:
      overrides.conformBody ??
      (mock.fn(
        async (
          _moduleArgs: Parameters<Generators["conformBody"]>[0],
          body: Parameters<Generators["conformBody"]>[1]
        ) => body
      ) as unknown as Generators["conformBody"]),
    callImage:
      overrides.callImage ??
      (mock.fn(
        async () => fixtures.imageSuccess
      ) as unknown as Generators["callImage"]),
    callVideo:
      overrides.callVideo ??
      (mock.fn(
        async () => fixtures.videoSuccess
      ) as unknown as Generators["callVideo"]),
    callAudio:
      overrides.callAudio ??
      (mock.fn(
        async () => fixtures.audioSuccess
      ) as unknown as Generators["callAudio"]),
    callMusic:
      overrides.callMusic ??
      (mock.fn(
        async () => fixtures.musicSuccess
      ) as unknown as Generators["callMusic"]),
  };
}

/**
 * Creates a mock AgentFileSystem.
 */
function createMockFileSystem(
  overrides: Partial<{
    add: AgentFileSystem["add"];
    getMany: AgentFileSystem["getMany"];
  }> = {}
): AgentFileSystem {
  let fileCounter = 0;
  return {
    add:
      overrides.add ??
      mock.fn((_part: DataPart, name?: string) => {
        fileCounter++;
        return `/mnt/${name ?? `file${fileCounter}`}`;
      }),
    getMany:
      overrides.getMany ??
      mock.fn(async (paths: string[]) => {
        return paths.map(() => ({
          inlineData: { mimeType: "image/png", data: "mock" },
        }));
      }),
    get: mock.fn(),
    files: {},
  } as unknown as AgentFileSystem;
}

/**
 * Creates a mock TaskTreeManager.
 */
function createMockTaskTreeManager(): TaskTreeManager {
  return {
    setInProgress: mock.fn(),
    setComplete: mock.fn(),
    set: mock.fn(),
  } as unknown as TaskTreeManager;
}

/**
 * Creates a mock PidginTranslator.
 */
function createMockTranslator(
  overrides: Partial<{
    fromPidginString: PidginTranslator["fromPidginString"];
    toPidgin: PidginTranslator["toPidgin"];
    contentToPidginString: PidginTranslator["contentToPidginString"];
  }> = {}
): PidginTranslator {
  return {
    fromPidginString:
      overrides.fromPidginString ??
      mock.fn(async (text: string) => ({
        parts: [{ text }],
        role: "user" as const,
      })),
    toPidgin:
      overrides.toPidgin ??
      mock.fn(async (content: LLMContent) => ({
        text: content.parts
          .filter((p): p is { text: string } => "text" in p)
          .map((p) => p.text)
          .join(""),
        tools: {},
      })),
    contentToPidginString:
      overrides.contentToPidginString ??
      mock.fn((content: LLMContent) =>
        content.parts
          .filter((p): p is { text: string } => "text" in p)
          .map((p) => p.text)
          .join("")
      ),
  } as unknown as PidginTranslator;
}

/**
 * Status updater call information.
 */
type StatusCall = {
  message: string | null;
  options?: { isThought?: boolean; expectedDurationInSec?: number };
};

/**
 * Mock status updater with call tracking.
 */
type MockStatusUpdater = StatusUpdateCallback & {
  getCalls(): StatusCall[];
};

/**
 * Creates a mock status updater callback with call tracking.
 */
function createMockStatusUpdater(): MockStatusUpdater {
  const calls: StatusCall[] = [];
  const fn = ((
    message: string | null,
    options?: { isThought?: boolean; expectedDurationInSec?: number }
  ) => {
    calls.push({ message, options });
  }) as MockStatusUpdater;
  fn.getCalls = () => calls;
  return fn;
}

/**
 * Creates a mock AgentEventSink for testing.
 *
 * - `emit()` captures events in `emitted`.
 * - `suspend()` returns the value from `suspendResponses` keyed by event type,
 *   or a generic empty object if not configured.
 */
function createMockSink(
  suspendResponses: Record<string, unknown> = {}
): AgentEventSink & { emitted: AgentEvent[] } {
  const emitted: AgentEvent[] = [];
  return {
    emitted,
    emit(event: AgentEvent) {
      emitted.push(event);
    },
    async suspend<T>(event: AgentEvent & { requestId: string }): Promise<T> {
      emitted.push(event);
      const response = suspendResponses[event.type];
      return (response ?? {}) as T;
    },
  };
}

/**
 * Creates complete GenerateFunctionArgs for testing.
 */
function createTestArgs(
  overrides: Partial<GenerateFunctionArgs> = {}
): GenerateFunctionArgs {
  return {
    fileSystem: overrides.fileSystem ?? createMockFileSystem(),
    moduleArgs: overrides.moduleArgs ?? stubModuleArgs,
    translator: overrides.translator ?? createMockTranslator(),
    taskTreeManager: overrides.taskTreeManager ?? createMockTaskTreeManager(),
    generators: overrides.generators ?? createMockGenerators(),
    sink: overrides.sink ?? createMockSink(),
  };
}

/**
 * Retrieves a handler from a function group by name.
 */
function getHandler(
  group: MappedDefinitions,
  name: string
): (
  params: Record<string, unknown>,
  statusUpdater: StatusUpdateCallback
) => Promise<Outcome<Record<string, unknown>>> {
  const def = group.definitions.find(([n]) => n === name);
  if (!def) {
    throw new Error(`Function "${name}" not found in group`);
  }
  return def[1].handler as (
    params: Record<string, unknown>,
    statusUpdater: StatusUpdateCallback
  ) => Promise<Outcome<Record<string, unknown>>>;
}
