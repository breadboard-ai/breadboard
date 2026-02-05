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
    this.#consoleEntry.work.set(crypto.randomUUID(), workItem);
  }

  /**
   * The agent started execution.
   */
  startAgent(objective: LLMContent) {
    if (this.#screen) {
      this.#screen.progress = StarterPhraseVendor.instance.phrase();
      this.#screen.expectedDuration = -1;
    }
    this.#addWorkItem("Objective", "summarize", objective);
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
   */
  sendRequest(model: string, body: GeminiBody) {
    this.#addWorkItem("Send request", "upload", {
      parts: [
        { text: `Calling model: ${model}` },
        { json: body as JsonSerializable },
      ],
    });
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
   */
  functionCall(part: FunctionCallCapabilityPart) {
    this.#addWorkItem(
      `Calling function "${part.functionCall.name}"`,
      "robot_server",
      { parts: [part] }
    );
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
   */
  functionResult(content: LLMContent) {
    this.#addWorkItem("Function response", "robot_server", content);
  }

  /**
   * The agent finished executing.
   */
  finish() {
    if (this.#screen) {
      this.#screen.progress = undefined;
      this.#screen.expectedDuration = -1;
    }
  }
}
