/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  ConsoleEntry,
  FunctionCallCapabilityPart,
  JsonSerializable,
  LLMContent,
} from "@breadboard-ai/types";
import { GeminiBody } from "../a2/gemini.js";
import { AgentProgressManager } from "./types.js";
import { llm, progressFromThought } from "../a2/utils.js";
import { StatusUpdateCallbackOptions } from "./function-definition.js";
import { StarterPhraseVendor } from "./starter-phrase-vendor.js";
import { ConsoleWorkItem } from "./console-work-item.js";

export { ConsoleProgressManager };

/**
 * Manages console progress updates for agent execution.
 * Creates individual WorkItems for each progress update and adds them to the
 * console entry. Also manages AppScreen updates for the app view.
 */
class ConsoleProgressManager implements AgentProgressManager {
  readonly #consoleEntry: ConsoleEntry | undefined;
  readonly #screen: AppScreen | undefined;
  #previousStatus: string | undefined;
  #agentSession: ConsoleWorkItem | undefined;
  #pendingCalls: Map<string, ConsoleWorkItem> = new Map();

  constructor(
    consoleEntry: ConsoleEntry | undefined,
    screen: AppScreen | undefined
  ) {
    this.#consoleEntry = consoleEntry;
    this.#screen = screen;
  }

  #addWorkItem(title: string, icon: string, body: LLMContent) {
    if (!this.#consoleEntry) return;

    const update = { type: "text" as const, title, icon, body };
    const workItem = new ConsoleWorkItem(title, icon, update);
    workItem.finish(); // Mark as done immediately
    this.#consoleEntry.work.set(crypto.randomUUID(), workItem);
  }

  /**
   * The agent started execution.
   * Creates the agent session WorkItem that accumulates early updates.
   */
  startAgent(objective: LLMContent) {
    if (this.#screen) {
      this.#screen.progress = StarterPhraseVendor.instance.phrase();
      this.#screen.expectedDuration = -1;
    }
    if (this.#consoleEntry) {
      const update = {
        type: "text" as const,
        title: "Objective",
        icon: "summarize",
        body: objective,
      };
      this.#agentSession = new ConsoleWorkItem(
        "Agent Session",
        "spark",
        update
      );
      this.#consoleEntry.work.set(crypto.randomUUID(), this.#agentSession);
    }
  }

  /**
   * The agent is generating layouts.
   */
  generatingLayouts(uiPrompt: LLMContent | undefined) {
    if (this.#screen) {
      this.#screen.progress = "Generating layouts";
      this.#screen.expectedDuration = 70;
    }
    this.#addWorkItem(
      "Generating Layouts",
      "web",
      uiPrompt ?? llm``.asContent()
    );
  }

  /**
   * The agent sent initial request.
   * Appends to the agent session WorkItem.
   */
  sendRequest(model: string, body: GeminiBody) {
    if (this.#agentSession) {
      this.#agentSession.addProduct({
        type: "text",
        title: "Send request",
        icon: "upload",
        body: {
          parts: [
            { text: `Calling model: ${model}` },
            { json: body as JsonSerializable },
          ],
        },
      });
    }
  }

  /**
   * The agent produced a thought.
   */
  thought(text: string) {
    this.#addWorkItem("Thought", "spark", llm`${text}`.asContent());
    if (this.#screen) {
      this.#previousStatus = this.#screen.progress;
      this.#screen.progress = progressFromThought(text);
      this.#screen.expectedDuration = -1;
    }
  }

  /**
   * The agent produced a function call.
   * Returns a unique ID for matching with the corresponding function result.
   */
  functionCall(part: FunctionCallCapabilityPart): string {
    const callId = crypto.randomUUID();
    if (this.#consoleEntry) {
      const update = {
        type: "text" as const,
        title: `Calling function "${part.functionCall.name}"`,
        icon: "robot_server",
        body: { parts: [part] },
      };
      const workItem = new ConsoleWorkItem(
        `Function: ${part.functionCall.name}`,
        "robot_server",
        update
      );
      // Don't finish yet - will be finished when result arrives
      this.#pendingCalls.set(callId, workItem);
      this.#consoleEntry.work.set(callId, workItem);
    }
    return callId;
  }

  /**
   * The agent function call produced an update.
   * This only updates the screen progress, does not create a WorkItem.
   */
  functionCallUpdate(
    _part: FunctionCallCapabilityPart,
    status: string | null,
    options?: StatusUpdateCallbackOptions
  ) {
    if (options?.isThought) {
      if (!status) return;
      this.thought(status);
    } else {
      if (!this.#screen) return;

      if (status == null) {
        if (this.#previousStatus) {
          this.#screen.progress = this.#previousStatus;
        }
        this.#screen.expectedDuration = -1;
      } else {
        // Remove the occasional ellipsis from the status
        status = status.replace(/\.+$/, "");
        if (options?.expectedDurationInSec) {
          this.#screen.expectedDuration = options.expectedDurationInSec;
        } else {
          this.#screen.expectedDuration = -1;
        }

        this.#previousStatus = this.#screen.progress;
        this.#screen.progress = status;
      }
    }
  }

  /**
   * The agent produced a function result.
   * Finds the WorkItem by callId and appends the result.
   */
  functionResult(callId: string, content: LLMContent) {
    const workItem = this.#pendingCalls.get(callId);
    if (workItem) {
      workItem.addProduct({
        type: "text",
        title: "Function response",
        icon: "robot_server",
        body: content,
      });
      workItem.finish();
      this.#pendingCalls.delete(callId);
    }
  }

  /**
   * The agent finished executing.
   * Closes the agent session WorkItem.
   */
  finish() {
    if (this.#screen) {
      this.#screen.progress = undefined;
      this.#screen.expectedDuration = -1;
    }
    this.#agentSession?.finish();
  }
}
