/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, ConsoleEntry, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator";
import { A2UIClientEventMessage } from "./a2ui/schemas";
import { A2ModuleArgs } from "../runnable-module-factory";
import { A2UIClientWorkItem } from "./a2ui/client-work-item";

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

  renderUserInterface(payload: unknown): Outcome<void> {
    const workItem = this.#getWorkItem();
    if (!ok(workItem)) return workItem;
    return workItem.renderUserInterface(payload);
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
