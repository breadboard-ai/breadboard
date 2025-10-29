/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, ConsoleEntry, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator";
import { A2ModuleArgs } from "../runnable-module-factory";
import { A2UIClientWorkItem } from "./a2ui/client-work-item";
import { A2UIClientEventMessage } from "./a2ui/schemas";
import { v0_8 } from "@breadboard-ai/a2ui";
import { A2UIClient } from "./a2ui/client";
import { A2UIAppScreen } from "./a2ui/app-screen";

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
  readonly client: A2UIClient;

  readonly #consoleEntry: ConsoleEntry | undefined;
  #appScreen: A2UIAppScreen | undefined;
  #workItem: A2UIClientWorkItem | undefined;
  #workItemId: string | null = null;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs,
    private readonly translator: PidginTranslator
  ) {
    this.client = new A2UIClient();
    const { currentStep, getProjectRunState } = this.moduleArgs.context;
    const stepId = currentStep?.id;
    if (stepId) {
      this.#consoleEntry = getProjectRunState?.()?.console.get(stepId);
    }
    if (!this.#consoleEntry) {
      console.warn(
        `Unable to find console entry for this agent. Trying to render UI will fail.`
      );
    }
  }

  #getWorkItem(): Outcome<A2UIClientWorkItem> {
    if (!this.#workItem) {
      return this.#createWorkItem();
    }
    return this.#workItem;
  }

  #getAppScreen(): Outcome<A2UIAppScreen> {
    if (!this.#appScreen) {
      this.#appScreen = new A2UIAppScreen(this.client, "A2UI");
      const app = this.moduleArgs.context?.getProjectRunState?.()?.app;
      if (!app) {
        return err(
          `Unable to get App. Agent won't be able to render to app preview`
        );
      }
      app.screens.set(crypto.randomUUID(), this.#appScreen);
    }
    return this.#appScreen;
  }

  #createWorkItem(): Outcome<A2UIClientWorkItem> {
    if (!this.#consoleEntry) {
      return err(`Unable to create UI: Console is not available`);
    }
    if (!this.#workItemId) {
      this.#workItemId = crypto.randomUUID();
    }
    this.#workItem = new A2UIClientWorkItem(this.client, "A2UI", "web");
    this.#consoleEntry.work.set(this.#workItemId, this.#workItem);
    return this.#workItem;
  }

  #updateWorkItem(): Outcome<A2UIClientWorkItem> {
    if (!this.#workItem) {
      return this.#createWorkItem();
    }
    if (!this.#consoleEntry) {
      return err(`Unable to update UI: Console is not available`);
    }
    this.#consoleEntry.work.delete(this.#workItemId!);
    this.#workItemId = crypto.randomUUID();

    this.#consoleEntry.work.set(this.#workItemId, this.#workItem);
    return this.#workItem;
  }

  renderUserInterface(
    payload: v0_8.Types.ServerToClientMessage[]
  ): Outcome<void> {
    const workItem = this.#updateWorkItem();
    if (!ok(workItem)) return workItem;
    this.client.processUpdates(payload);
    this.#getAppScreen();
    workItem.renderUserInterface();
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    const workItem = this.#updateWorkItem();
    if (!ok(workItem)) return workItem;
    const appScreen = this.#getAppScreen();
    if (!ok(appScreen)) return appScreen;
    appScreen.awaitUserInput = true;
    const result = await this.client.awaitUserInput();
    appScreen.awaitUserInput = false;
    return result;
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
