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
  DeepReadonly,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { PidginTranslator } from "./pidgin-translator.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { A2UIClientWorkItem } from "./a2ui/client-work-item.js";
import { A2UIClientEventMessage } from "./a2ui/schemas.js";
import { v0_8 } from "../../a2ui/index.js";
import { A2UIClient } from "./a2ui/client.js";
import { A2UIAppScreenOutput } from "./a2ui/app-screen-output.js";
import { ProgressWorkItem } from "./progress-work-item.js";
import {
  A2UIRenderer,
  ChatChoice,
  ChatChoiceLayout,
  ChatChoicesResponse,
  ChatChoiceSelectionMode,
  ChatInputType,
  ChatManager,
  ChatResponse,
  VALID_INPUT_TYPES,
} from "./types.js";
import { getCurrentStepState } from "../a2/output.js";
import { ChoicePresenter } from "./choice-presenter.js";

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

class AgentUI implements A2UIRenderer, ChatManager {
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

  readonly #chatLog: LLMContent[] = [];

  readonly #choicePresenter: ChoicePresenter;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs,
    private readonly translator: PidginTranslator
  ) {
    this.client = new A2UIClient();
    const { appScreen, consoleEntry } = getCurrentStepState(this.moduleArgs);
    this.#consoleEntry = consoleEntry;
    this.#appScreen = appScreen;
    if (!this.#appScreen) {
      console.warn(
        `Unable to find app screen for this agent. Trying to render UI will fail.`
      );
    }
    this.progress = new ProgressWorkItem("Agent", "spark", this.#appScreen);
    this.#choicePresenter = new ChoicePresenter(translator, this);
    if (!this.#consoleEntry) {
      console.warn(
        `Unable to find console entry for this agent. Trying to render UI will fail.`
      );
    } else {
      this.#consoleEntry.work.set(crypto.randomUUID(), this.progress);
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

  get chatLog(): DeepReadonly<LLMContent[]> {
    return this.#chatLog;
  }

  async chat(
    pidginString: string,
    inputType: string
  ): Promise<Outcome<ChatResponse>> {
    const typedInputType = (VALID_INPUT_TYPES as readonly string[]).includes(
      inputType
    )
      ? (inputType as ChatInputType)
      : "any";
    const message = await this.translator.fromPidginString(pidginString);
    if (!ok(message)) return message;
    this.#chatLog.push({ ...message, role: "model" });
    await this.caps.output({
      schema: {
        properties: { message: { type: "object", behavior: ["llm-content"] } },
      },
      message,
    });
    const response = (await this.caps.input({
      schema: {
        properties: {
          input: {
            type: "object",
            behavior: ["transient", "llm-content", "hint-required"],
            format: computeFormat(typedInputType),
          },
        },
      },
    })) as Outcome<ChatResponse>;
    if (!ok(response)) return response;
    this.#chatLog.push({ ...response.input, role: "user" });
    return response;
  }

  /**
   * Presents choices to the user and returns the selected choice IDs.
   *
   * For "single" mode: renders choice buttons - clicking one returns that ID.
   * For "multiple" mode: renders checkboxes with a submit button.
   *
   * Both message and choice labels support pidgin format with file references.
   */
  async presentChoices(
    message: string,
    choices: ChatChoice[],
    selectionMode: ChatChoiceSelectionMode,
    layout: ChatChoiceLayout = "list"
  ): Promise<Outcome<ChatChoicesResponse>> {
    return this.#choicePresenter.presentChoices(
      message,
      choices,
      selectionMode,
      layout
    );
  }

  async render(
    a2UIPayload: unknown[]
  ): Promise<Outcome<Record<string, unknown>>> {
    const rendering = this.renderUserInterface(
      a2UIPayload as v0_8.Types.ServerToClientMessage[]
    );
    if (!ok(rendering)) return rendering;
    return this.awaitUserInput();
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
}

function computeFormat(inputType: ChatInputType): string {
  switch (inputType) {
    case "any":
      return "asterisk";
    case "file-upload":
      return "upload";
    case "text":
      return "edit_note";
  }
}
