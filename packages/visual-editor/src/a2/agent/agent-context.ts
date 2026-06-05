/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import { MemoryManager, RunState } from "./types.js";
import type { AgentEvent } from "./agent-event.js";
import {
  SheetManager,
  SheetManagerConfig,
} from "../google-drive/sheet-manager.js";
import { memorySheetGetter } from "../google-drive/memory-sheet-getter.js";
import type { A2UIData, EvalFileData } from "../../types/types.js";

export { AgentContext };
export type { AgentContextConfig };

type AgentContextConfig = SheetManagerConfig;

class AgentContext {
  readonly memoryManager: MemoryManager;
  readonly #runs = new Map<string, RunState>();

  constructor(config: AgentContextConfig) {
    this.memoryManager = new SheetManager(config, memorySheetGetter(config));
  }

  /**
   * Creates and registers a new run state.
   */
  createRun(id: string, objective: LLMContent): RunState {
    const state: RunState = {
      id,
      status: "running",
      startTime: Date.now(),
      contents: [],
      lastCompleteTurnIndex: -1,
      objective,
      files: {},
      resumable: true,
      a2uiSurfaces: [],
    };
    this.#runs.set(id, state);
    return state;
  }

  /**
   * Gets a run by ID.
   */
  getRun(id: string): RunState | undefined {
    return this.#runs.get(id);
  }

  /**
   * Gets all registered runs.
   */
  getAllRuns(): RunState[] {
    return [...this.#runs.values()];
  }

  /**
   * Gets all registered runs as arrays of AgentEvent.
   */
  getAllRunsAsEvents(): AgentEvent[][] {
    return this.getAllRuns().map((run) => getEventsFromRunState(run));
  }

  /**
   * Marks all failed runs as non-resumable (called when graph is edited).
   */
  invalidateResumableRuns(): void {
    for (const run of this.#runs.values()) {
      if (run.status === "failed") {
        run.resumable = false;
      }
    }
  }

  /**
   * Clears all runs (called when switching to a different graph).
   */
  clearAllRuns(): void {
    this.#runs.clear();
  }

  /**
   * Exports all runs in EvalFileData format for eval viewer compatibility.
   * Returns an array containing FinalChainReport entries and OutcomePayload entries.
   */
  exportTraces(): EvalFileData {
    const result: EvalFileData = [];

    for (const run of this.getAllRuns()) {
      // Compute metrics from contents
      let totalThoughts = 0;
      let totalFunctionCalls = 0;
      let turnCount = 0;

      for (const content of run.contents) {
        if (content.role === "model") {
          turnCount++;
        }
        for (const part of content.parts ?? []) {
          if ("thought" in part && part.thought) {
            totalThoughts++;
          } else if ("functionCall" in part) {
            totalFunctionCalls++;
          }
        }
      }

      // Extract config from requestBody (remove contents)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { contents: _, ...config } = run.requestBody ?? {};

      // Add context entry
      result.push({
        type: "context" as const,
        startedDateTime: new Date(run.startTime).toISOString(),
        totalDurationMs: (run.endTime ?? Date.now()) - run.startTime,
        turnCount,
        totalRequestTimeMs: 0, // Not tracked
        totalThoughts,
        totalFunctionCalls,
        context: run.contents,
        config: Object.keys(config).length > 0 ? config : null,
      });

      // Add outcome entry
      // Convert files to intermediate format (FileData[])
      const intermediate = Object.entries(run.files).map(([path, file]) => ({
        path,
        content: { parts: [{ text: file.data }] } as LLMContent,
      }));

      // Get the last model response as outcomes
      const lastModelContent = run.contents
        .filter((c) => c.role === "model")
        .at(-1);

      result.push({
        type: "outcome" as const,
        outcome: {
          success: run.status === "completed",
          href: "",
          outcomes: lastModelContent ?? { parts: [] },
          intermediate: intermediate.length > 0 ? intermediate : undefined,
        },
      });

      // Add A2UI surfaces if any were rendered during this run
      if (run.a2uiSurfaces.length > 0) {
        result.push({
          type: "a2ui" as const,
          data: run.a2uiSurfaces,
        } satisfies A2UIData);
      }
    }

    return result;
  }
}

/**
 * Reconstructs the high-fidelity AgentEvent history from a RunState.
 */
function getEventsFromRunState(run: RunState): AgentEvent[] {
  const events: AgentEvent[] = [];

  // 1. Objective/Start
  if (run.objective) {
    events.push({
      start: { objective: run.objective },
    });
  }

  // 2. Turns
  for (const content of run.contents) {
    if (content.role === "model") {
      // Extract structural parts first (thoughts and tool calls)
      for (const part of content.parts ?? []) {
        if ("thought" in part && part.thought && "text" in part) {
          events.push({
            thought: { text: part.text },
          });
        } else if ("functionCall" in part && part.functionCall) {
          events.push({
            functionCall: {
              callId: part.functionCall.name,
              name: part.functionCall.name,
              args: part.functionCall.args as Record<string, unknown>,
            },
          });
        }
      }

      // Add the overall model response content
      events.push({
        content: { content },
      });
    } else if (content.role === "user") {
      let isFunctionResult = false;

      // Extract tool results
      for (const part of content.parts ?? []) {
        if ("functionResponse" in part && part.functionResponse) {
          events.push({
            functionResult: {
              callId: part.functionResponse.name,
              content: content,
            },
          });
          isFunctionResult = true;
        }
      }

      // If it's a direct user message rather than a tool result
      if (!isFunctionResult) {
        events.push({
          content: { content },
        });
      }
    }
  }

  // 3. Final Outcome
  if (run.status === "completed") {
    const lastModelContent = run.contents.filter((c) => c.role === "model").at(-1);
    events.push({
      complete: {
        result: {
          success: true,
          href: "",
          outcomes: lastModelContent ?? { parts: [] },
        },
      },
    });
  } else if (run.status === "failed") {
    events.push({
      error: { message: run.error ?? "Run failed" },
    });
  }

  return events;
}
