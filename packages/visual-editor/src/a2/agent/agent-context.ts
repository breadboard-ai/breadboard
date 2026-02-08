/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import { MemoryManager, RunState } from "./types.js";
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
