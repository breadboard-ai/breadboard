/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  DataPart,
  FunctionCallCapabilityPart,
  GroupParticle,
  JsonSerializable,
  LLMContent,
  Particle,
  WorkItem,
} from "@breadboard-ai/types";
import { signal } from "signal-utils";
import { now } from "./now.js";
import { SignalMap } from "signal-utils/map";
import { GeminiBody } from "../a2/gemini.js";
import { AgentProgressManager } from "./types.js";
import { llm, progressFromThought } from "../a2/utils.js";
import { StatusUpdateCallbackOptions } from "./function-definition.js";
import { StarterPhraseVendor } from "./starter-phrase-vendor.js";

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

  readonly product: Map<string, Particle> = new SignalMap();

  index = 0;

  #previousStatus: string | undefined;

  constructor(
    public readonly title: string,
    public readonly icon: string,
    private readonly screen: AppScreen | undefined
  ) {
    this.start = performance.now();
  }

  #add(title: string, icon: string, content: unknown) {
    return this.product.set(
      `${this.index++}`,
      createUpdate(title, icon, content)
    );
  }

  #addParts(title: string, icon: string, parts: DataPart[]) {
    return this.#add(title, icon, { parts });
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

function createUpdate(title: string, icon: string, body: unknown) {
  let bodyParticle;
  if (!body) {
    bodyParticle = { text: "Empty content" };
  } else if (typeof body === "string") {
    bodyParticle = { text: body };
  } else if (typeof body === "object" && "parts" in body) {
    bodyParticle = {
      text: JSON.stringify(body),
      mimeType: "application/vnd.breadboard.llm-content",
    };
  } else {
    bodyParticle = {
      text: JSON.stringify(body),
      mimeType: "application/json",
    };
  }
  const group: GroupParticle["group"] = new Map([
    ["title", { text: title }],
    ["body", bodyParticle],
    ["icon", { text: icon }],
  ]);
  return { type: "update", group };
}
