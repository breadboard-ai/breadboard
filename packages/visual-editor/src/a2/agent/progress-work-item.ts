/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  ConsoleLink,
  ConsoleUpdate,
  DataPart,
  FunctionCallCapabilityPart,
  JsonSerializable,
  LLMContent,
  SimplifiedA2UIClient,
  WorkItem,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { now } from "./now.js";
import { GeminiBody } from "../a2/gemini.js";
import { AgentProgressManager } from "./types.js";
import { llm, progressFromThought } from "../a2/utils.js";
import { StatusUpdateCallbackOptions } from "./function-definition.js";
import { StarterPhraseVendor } from "./starter-phrase-vendor.js";
import { v0_8 } from "../../a2ui/index.js";

export { ProgressWorkItem };

class ProgressWorkItem implements WorkItem, AgentProgressManager {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }
  /**
   * This means something different from us awaiting the user input in the
   * Console vernacular. Here, we always return false for now.
   */
  readonly awaitingUserInput = false;

  readonly start: number;

  readonly openByDefault = true;

  readonly chat = false;

  readonly workItemId = crypto.randomUUID();

  readonly product: Map<string, ConsoleUpdate> = new SignalMap();

  #updateCounter = 0;
  #previousStatus: string | undefined;

  constructor(
    public readonly title: string,
    public readonly icon: string,
    private readonly screen: AppScreen | undefined
  ) {
    this.start = performance.now();
  }

  #add(title: string, icon: string, body: LLMContent) {
    const key = `update-${this.#updateCounter++}`;
    this.product.set(key, { type: "text", title, icon, body });
  }

  /**
   * Add an update to the progress work item.
   * Public method for external callers like StreamableReporter.
   */
  addUpdate(title: string, icon: string, body: LLMContent) {
    this.#add(title, icon, body);
  }

  /**
   * Add links to the progress work item.
   * Public method for external callers like StreamableReporter.
   */
  addLinks(title: string, icon: string, links: ConsoleLink[]) {
    const key = `update-${this.#updateCounter++}`;
    this.product.set(key, { type: "links", title, icon, links });
  }

  /**
   * Add A2UI content to the progress work item.
   * Creates a SimplifiedA2UIClient with a processor and no-op receiver.
   * @param messages - A2UI ServerToClientMessage array (untyped from parsed JSON)
   */
  addA2UI(messages: unknown[]) {
    const processor = v0_8.Data.createSignalA2UIModelProcessor();
    processor.processMessages(messages as v0_8.Types.ServerToClientMessage[]);
    const key = `a2ui-${this.#updateCounter++}`;
    const client: SimplifiedA2UIClient = {
      processor,
      receiver: { sendMessage: () => {} }, // No-op receiver for display-only
    };
    // Cast to unknown first since product map type doesn't include SimplifiedA2UIClient directly
    (this.product as Map<string, unknown>).set(key, client);
  }

  #addParts(title: string, icon: string, parts: DataPart[]) {
    this.#add(title, icon, { parts });
  }

  /**
   * The agent started execution.
   */
  startAgent(objective: LLMContent) {
    if (this.screen) {
      this.screen.progress = StarterPhraseVendor.instance.phrase();
      this.screen.expectedDuration = -1;
    }
    this.#add("Objective", "summarize", objective);
  }

  generatingLayouts(uiPrompt: LLMContent | undefined) {
    if (this.screen) {
      this.screen.progress = "Generating layouts";
      this.screen.expectedDuration = 70;
    }
    this.#add("Generating Layouts", "web", uiPrompt ?? llm``.asContent());
  }

  /**
   * The agent sent initial request.
   */
  sendRequest(model: string, body: GeminiBody) {
    this.#addParts("Send request", "upload", [
      { text: `Calling model: ${model}` },
      { json: body as JsonSerializable },
    ]);
  }

  /**
   * The agent produced a thought.
   */
  thought(text: string) {
    this.#add("Thought", "spark", llm`${text}`.asContent());
    if (this.screen) {
      this.#previousStatus = this.screen.progress;
      this.screen.progress = progressFromThought(text);
      this.screen.expectedDuration = -1;
    }
  }

  /**
   * The agent produced a function call.
   */
  functionCall(part: FunctionCallCapabilityPart) {
    this.#addParts(
      `Calling function "${part.functionCall.name}"`,
      "robot_server",
      [part]
    );
  }

  /**
   * The agent function call produced an update
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
      if (!this.screen) return;

      if (status == null) {
        if (this.#previousStatus) {
          this.screen.progress = this.#previousStatus;
        }
        this.screen.expectedDuration = -1;
      } else {
        // Remove the occasional ellipsis from the status
        status = status.replace(/\.+$/, "");
        if (options?.expectedDurationInSec) {
          this.screen.expectedDuration = options.expectedDurationInSec;
        } else {
          this.screen.expectedDuration = -1;
        }

        this.#previousStatus = this.screen.progress;
        this.screen.progress = status;
      }
    }
  }

  /**
   * The agent produced a function result.
   */
  functionResult(content: LLMContent) {
    this.#add("Function response", "robot_server", content);
  }

  /**
   * The agent finished executing.
   */
  finish() {
    if (this.screen) {
      this.screen.progress = undefined;
      this.screen.expectedDuration = -1;
    }
    this.end = performance.now();
  }
}
