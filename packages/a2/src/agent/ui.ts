/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  ConsoleEntry,
  LLMContent,
  Outcome,
  Particle,
  WorkItem,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator";
import { A2UIClientEventMessage } from "./a2ui/schemas";
import { A2ModuleArgs } from "../runnable-module-factory";
import { signal } from "signal-utils";
import { Signal } from "signal-polyfill";
import { SignalMap } from "signal-utils/map";

export { AgentUI };

export type UserInputType =
  | "singleline-text"
  | "multiline-text"
  | "confirm"
  | "image"
  | "video";

export type UserResponse = {
  file_path?: string;
  text?: string;
};

export type RawUserResponse = {
  text: string;
};

const now = new Signal.State(performance.now());

class A2UIClientWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  @signal
  get awaitingUserInput() {
    return false;
  }

  readonly start: number;

  readonly chat = false;

  readonly product: Map<string, LLMContent | Particle> = new SignalMap();

  constructor(
    public readonly title: string,
    public readonly icon: string
  ) {
    this.start = performance.now();
  }
}

class AgentUI {
  readonly #entry: ConsoleEntry | undefined;
  #workItem: A2UIClientWorkItem | undefined;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs,
    private readonly translator: PidginTranslator
  ) {
    const { currentStep, getProjectRunState } = this.moduleArgs.context;
    const stepId = currentStep?.id;
    if (stepId) {
      this.#entry = getProjectRunState?.()?.console.get(stepId);
    }
    if (!this.#entry) {
      console.warn(
        `Unable to find console entry for this agent. Trying to render UI will fail.`
      );
    }
  }

  #getWorkItem(): Outcome<A2UIClientWorkItem> {
    if (!this.#workItem) {
      if (!this.#entry) {
        return err(`Unable to create UI: Console is not available`);
      }
      this.#workItem = new A2UIClientWorkItem("A2UI", "web");
      this.#entry.work.set(crypto.randomUUID(), this.#workItem);
    }
    return this.#workItem;
  }

  async renderUserInterface(payload: unknown): Promise<Outcome<void>> {
    const workItem = this.#getWorkItem();
    if (!ok(workItem)) return workItem;
    const surfaceId = crypto.randomUUID();
    workItem.product.set(surfaceId, {
      type: "a2ui",
      group: new Map([
        ["title", { text: "TITLE" }],
        [
          "body",
          { text: JSON.stringify(payload), mimeType: "application/json" },
        ],
      ]),
    });
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return err(`I can't wait to learn how to wait on user's input!!!1`);
  }

  async requestUserInput(
    message: string,
    type: UserInputType
  ): Promise<Outcome<UserResponse>> {
    console.log("REQUEST USER INPUT");
    console.log("MESSAGE", message);
    console.log("TYPE", type);
    await this.caps.output({
      schema: {
        properties: { message: { type: "object", behavior: ["llm-content"] } },
      },
      message: this.translator.fromPidginString(message),
    });
    const response = (await this.caps.input({
      schema: {
        properties: { text: { type: "string", behavior: ["transient"] } },
      },
    })) as Outcome<RawUserResponse>;
    if (!ok(response)) return response;
    return response;
  }
}
