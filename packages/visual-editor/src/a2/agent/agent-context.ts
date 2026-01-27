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
      startTime: performance.now(),
      contents: [],
      lastCompleteTurnIndex: -1,
      objective,
      files: {},
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
   * Exports all runs as a JSON-serializable object for DevTools download.
   */
  exportTraces(): object {
    return {
      exportedAt: new Date().toISOString(),
      runs: this.getAllRuns(),
    };
  }
}
