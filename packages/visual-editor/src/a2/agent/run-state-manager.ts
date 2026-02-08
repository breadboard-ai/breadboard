/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { GeminiBody } from "../a2/gemini.js";
import { RunState } from "./types.js";
import type { ServerToClientMessage } from "../../a2ui/0.8/types/types.js";
import { AgentFileSystem } from "./file-system.js";
import { AgentContext } from "./agent-context.js";

export { RunStateManager };

type StartResult = {
  contents: LLMContent[];
  isResuming: boolean;
};

/**
 * Manages run state tracking, including creation, resumption, and finalization.
 * Encapsulates all run state logic to keep the main agent loop clean.
 */
class RunStateManager {
  #runState?: RunState;

  constructor(
    private readonly agentContext: AgentContext,
    private readonly fileSystem: AgentFileSystem
  ) {}

  /**
   * Starts a new run or resumes a previous failed run.
   * Returns the initial contents array and whether this is a resumption.
   */
  startOrResume(
    stepId: string | undefined,
    objectiveContent: LLMContent
  ): StartResult {
    if (!stepId) {
      return { contents: [objectiveContent], isResuming: false };
    }

    const resumableRun = this.#findResumableRun(stepId);
    if (resumableRun) {
      const contents = [
        objectiveContent,
        ...this.#restoreFromRun(resumableRun),
      ];
      console.log(
        `Resuming run ${resumableRun.id} from turn ${resumableRun.lastCompleteTurnIndex + 1}`
      );
      return { contents, isResuming: true };
    }

    // Fresh start - create new run state
    this.#runState = this.agentContext.createRun(stepId, objectiveContent);
    return { contents: [objectiveContent], isResuming: false };
  }

  /**
   * Starts a fresh run without attempting to resume a previous one.
   * Used when resumability is disabled via feature flag.
   */
  startFresh(
    stepId: string | undefined,
    objectiveContent: LLMContent
  ): StartResult {
    if (stepId) {
      this.#runState = this.agentContext.createRun(stepId, objectiveContent);
    }
    return { contents: [objectiveContent], isResuming: false };
  }

  /**
   * Tracks a content item in the current run.
   */
  pushContent(content: LLMContent): void {
    if (this.#runState) {
      this.#runState.contents.push(content);
    }
  }

  /**
   * Increments the turn index after a complete turn.
   */
  completeTurn(): void {
    if (this.#runState) {
      this.#runState.lastCompleteTurnIndex++;
    }
  }

  /**
   * Captures the request body on the first request only.
   */
  captureRequestBody(model: string, body: GeminiBody): void {
    if (this.#runState && !this.#runState.requestBody) {
      this.#runState.model = model;
      this.#runState.requestBody = body;
    }
  }

  /**
   * Appends a rendered A2UI surface (message array) to the current run.
   */
  pushA2UISurface(messages: ServerToClientMessage[]): void {
    if (this.#runState) {
      this.#runState.a2uiSurfaces.push(messages);
    }
  }

  /**
   * Marks run as failed and captures files, returning the error for pass-through.
   * Filters out any contents with $error parts before saving.
   */
  fail<T extends { $error: string }>(error: T): T {
    if (this.#runState) {
      this.#runState.status = "failed";
      this.#runState.error = error.$error;
      this.#runState.endTime = Date.now();
      // Filter out content items containing $error parts
      this.#runState.contents = this.#runState.contents.filter(
        (content) =>
          !content.parts?.some(
            (part) => "$error" in part || (part as { $error?: unknown }).$error
          )
      );
      this.#captureFiles();
    }
    return error;
  }

  /**
   * Marks run as completed and captures files.
   */
  complete(): void {
    if (this.#runState) {
      this.#runState.status = "completed";
      this.#runState.endTime = Date.now();
      this.#captureFiles();
    }
  }

  /**
   * Finds a resumable failed run for the given step ID.
   */
  #findResumableRun(stepId: string): RunState | undefined {
    const run = this.agentContext.getRun(stepId);
    return run?.status === "failed" && run.resumable ? run : undefined;
  }

  /**
   * Restores state from a previous failed run.
   * Trims trailing model turns so the conversation ends on a user turn.
   */
  #restoreFromRun(run: RunState): LLMContent[] {
    // Restore file system
    this.fileSystem.restoreFrom(run.files);
    // Reuse the run state
    this.#runState = run;
    run.status = "running";
    run.error = undefined;
    // Trim trailing model turns
    const contents = [...run.contents];
    while (contents.length > 0 && contents.at(-1)?.role === "model") {
      contents.pop();
    }
    return contents;
  }

  /**
   * Captures current file system state into run state.
   */
  #captureFiles(): void {
    if (this.#runState) {
      for (const [path, file] of this.fileSystem.files) {
        this.#runState.files[path] = { ...file };
      }
    }
  }
}
