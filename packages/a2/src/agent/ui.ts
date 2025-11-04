/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreen,
  AppScreenOutput,
  Capabilities,
  ConsoleEntry,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator";
import { A2ModuleArgs } from "../runnable-module-factory";
import { A2UIClientWorkItem } from "./a2ui/client-work-item";
import { A2UIClientEventMessage } from "./a2ui/schemas";
import { v0_8 } from "@breadboard-ai/a2ui";
import { A2UIClient } from "./a2ui/client";
import { A2UIAppScreenOutput } from "./a2ui/app-screen-output";
import { ProgressWorkItem } from "./progress-work-item";

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

const FUNCTION_MAP = new Map([
  ["generate_text", "Generating text"],
  ["generate_images_from_prompt", "Generaeting images"],
  ["ui_render_user_interface", "Designing user interface"],
  ["ui_await_user_input", "Processing user input"],
  ["system_write_text_to_file", "Storing data to remember later"],
  ["system_append_text_to_file", "Adding data to remember later"],
  ["system_create_project", "Organizing a new project"],
  ["system_add_files_to_project", "Adding data to project"],
  ["system_list_project_contents", "Examining project contents"],
]);

class AgentUI {
  readonly client: A2UIClient;

  /**
   * The id for the console work item and app output that shows the user-facing
   * UI.
   */
  #outputId = crypto.randomUUID();

  readonly #consoleEntry: ConsoleEntry | undefined;

  /**
   * Handles the console updates for various parts of agent execution
   */
  readonly progress;

  #outputWorkItem: A2UIClientWorkItem | undefined;

  readonly #appScreen: AppScreen | undefined;
  #appScreenOutput: AppScreenOutput | undefined;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs,
    private readonly translator: PidginTranslator
  ) {
    this.client = new A2UIClient();
    const { currentStep, getProjectRunState } = this.moduleArgs.context;
    const stepId = currentStep?.id;
    if (stepId) {
      const runState = getProjectRunState?.();
      this.#consoleEntry = runState?.console.get(stepId);
      this.#appScreen = runState?.app.screens.get(stepId);
    }
    this.progress = new ProgressWorkItem(
      "Agent",
      "spark",
      this.#appScreen!,
      FUNCTION_MAP
    );
    if (!this.#consoleEntry) {
      console.warn(
        `Unable to find console entry for this agent. Trying to render UI will fail.`
      );
    } else {
      this.#consoleEntry.work.set(crypto.randomUUID(), this.progress);
    }
    if (!this.#appScreen) {
      console.warn(
        `Unable to find app screen for this agent. Trying to render UI will fail.`
      );
    }
  }

  #ensureAppScreenOutput(): Outcome<void> {
    if (!this.#appScreen) {
      return err(`Unable to create UI: App screen is not available`);
    }
    if (this.#appScreenOutput) return;

    this.#appScreenOutput = new A2UIAppScreenOutput(this.client);
    this.#appScreen.outputs.set(this.#outputId, this.#appScreenOutput);
    this.#appScreen.type = "a2ui";
  }

  #createWorkItem(): Outcome<A2UIClientWorkItem> {
    if (!this.#consoleEntry) {
      return err(`Unable to create UI: Console is not available`);
    }
    this.#outputWorkItem = new A2UIClientWorkItem(this.client, "A2UI", "web");
    this.#consoleEntry.work.set(this.#outputId, this.#outputWorkItem);
    return this.#outputWorkItem;
  }

  #updateWorkItem(): Outcome<A2UIClientWorkItem> {
    if (!this.#outputWorkItem) {
      return this.#createWorkItem();
    }
    if (!this.#consoleEntry) {
      return err(`Unable to update UI: Console is not available`);
    }
    return this.#outputWorkItem;
  }

  renderUserInterface(
    messages: v0_8.Types.ServerToClientMessage[]
  ): Outcome<void> {
    const workItem = this.#updateWorkItem();
    if (!ok(workItem)) return workItem;
    const translation = this.translator.fromPidginMessages(messages);
    this.client.processUpdates(translation);

    const ensureAppScreenOutput = this.#ensureAppScreenOutput();
    if (!ok(ensureAppScreenOutput)) return ensureAppScreenOutput;

    workItem.renderUserInterface();
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    const workItem = this.#updateWorkItem();
    if (!ok(workItem)) return workItem;

    const ensureAppScreenOutput = this.#ensureAppScreenOutput();
    if (!ok(ensureAppScreenOutput)) return ensureAppScreenOutput;

    this.#appScreen!.status = "interactive";
    const result = await this.client.awaitUserInput();
    this.#appScreen!.status = "processing";
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
