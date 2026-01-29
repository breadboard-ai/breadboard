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
  ChatChoicesResponse,
  ChatChoiceSelectionMode,
  ChatInputType,
  ChatManager,
  ChatResponse,
  VALID_INPUT_TYPES,
} from "./types.js";
import { getCurrentStepState } from "../a2/output.js";
import { llmContentToA2UIComponents } from "./llm-content-to-a2ui.js";
import { isTextCapabilityPart } from "../../data/common.js";

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
    selectionMode: ChatChoiceSelectionMode
  ): Promise<Outcome<ChatChoicesResponse>> {
    const surfaceId = "@choices";

    // Translate pidgin strings to LLMContent
    const messageContent = await this.translator.fromPidginString(message);
    if (!ok(messageContent)) return messageContent;

    const translatedChoices: { id: string; content: LLMContent }[] = [];
    for (const choice of choices) {
      const labelContent = await this.translator.fromPidginString(choice.label);
      if (!ok(labelContent)) return labelContent;
      translatedChoices.push({ id: choice.id, content: labelContent });
    }

    if (selectionMode === "single") {
      return this.#presentSingleChoice(
        messageContent,
        translatedChoices,
        surfaceId
      );
    } else {
      return this.#presentMultipleChoice(
        messageContent,
        translatedChoices,
        surfaceId
      );
    }
  }

  async #presentSingleChoice(
    messageContent: LLMContent,
    choices: { id: string; content: LLMContent }[],
    surfaceId: string
  ): Promise<Outcome<ChatChoicesResponse>> {
    const allParts: v0_8.Types.ComponentInstance[] = [];
    const topLevelIds: string[] = [];

    // Convert message to components
    const messageComponents = llmContentToA2UIComponents(messageContent, {
      idPrefix: "message",
    });
    allParts.push(...messageComponents.parts);

    // Wrap message components in a container if there are multiple
    if (messageComponents.ids.length > 1) {
      const messageContainerId = "message-container";
      allParts.push({
        id: messageContainerId,
        component: {
          Column: {
            children: { explicitList: messageComponents.ids },
          },
        },
      });
      topLevelIds.push(messageContainerId);
    } else if (messageComponents.ids.length === 1) {
      topLevelIds.push(messageComponents.ids[0]);
    }

    // Build buttons for each choice
    const buttonIds: string[] = [];
    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const choiceComponents = llmContentToA2UIComponents(choice.content, {
        idPrefix: `choice-${i}`,
      });
      allParts.push(...choiceComponents.parts);

      // Create a row container for the choice content
      const choiceContentId = `choice-content-${i}`;
      allParts.push({
        id: choiceContentId,
        component: {
          Row: {
            children: { explicitList: choiceComponents.ids },
          },
        },
      });

      // Create button wrapping the choice content
      const buttonId = `choice-btn-${i}`;
      allParts.push({
        id: buttonId,
        component: {
          Button: {
            child: choiceContentId,
            action: {
              name: "select",
              context: [
                {
                  key: "choiceId",
                  value: { literalString: choice.id },
                },
              ],
            },
          },
        },
      });
      buttonIds.push(buttonId);
    }

    // Build the root column layout
    const rootComponent: v0_8.Types.ComponentInstance = {
      id: "root",
      component: {
        Column: {
          children: {
            explicitList: [...topLevelIds, ...buttonIds],
          },
          distribution: "start",
          alignment: "stretch",
        },
      },
    };
    allParts.push(rootComponent);

    const messages: v0_8.Types.ServerToClientMessage[] = [
      {
        surfaceUpdate: {
          surfaceId,
          components: allParts,
        },
      },
      {
        beginRendering: {
          surfaceId,
          root: "root",
        },
      },
    ];

    // Render the UI and await user input
    const rendering = this.renderUserInterface(messages);
    if (!ok(rendering)) return rendering;

    const userAction = await this.awaitUserInput();
    if (!ok(userAction)) return userAction;

    // Extract the selected choice ID from the action context
    const choiceId = userAction.userAction?.context?.choiceId;
    if (typeof choiceId !== "string") {
      return err("No choice was selected");
    }

    return { selected: [choiceId] };
  }

  async #presentMultipleChoice(
    messageContent: LLMContent,
    choices: { id: string; content: LLMContent }[],
    surfaceId: string
  ): Promise<Outcome<ChatChoicesResponse>> {
    const allParts: v0_8.Types.ComponentInstance[] = [];
    const topLevelIds: string[] = [];

    // Convert message to components
    const messageComponents = llmContentToA2UIComponents(messageContent, {
      idPrefix: "message",
    });
    allParts.push(...messageComponents.parts);

    // Wrap message components in a container if there are multiple
    if (messageComponents.ids.length > 1) {
      const messageContainerId = "message-container";
      allParts.push({
        id: messageContainerId,
        component: {
          Column: {
            children: { explicitList: messageComponents.ids },
          },
        },
      });
      topLevelIds.push(messageContainerId);
    } else if (messageComponents.ids.length === 1) {
      topLevelIds.push(messageComponents.ids[0]);
    }

    // Build checkbox components for each choice
    // Note: CheckBox uses a string label, so we extract text from the first text part
    const checkboxIds: string[] = [];
    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      // Extract text from LLMContent for the label
      const textPart = choice.content.parts.find(isTextCapabilityPart);
      const labelText = textPart?.text.trim() ?? `Choice ${choice.id}`;

      const checkboxId = `choice-checkbox-${i}`;
      allParts.push({
        id: checkboxId,
        component: {
          CheckBox: {
            label: { literalString: labelText },
            value: { path: `/selections/${choice.id}` },
          },
        },
      });
      checkboxIds.push(checkboxId);
    }

    // Build submit button
    const submitButtonText: v0_8.Types.ComponentInstance = {
      id: "submit-text",
      component: {
        Text: {
          text: { literalString: "Submit" },
          usageHint: "body",
        },
      },
    };
    allParts.push(submitButtonText);

    const submitButton: v0_8.Types.ComponentInstance = {
      id: "submit-btn",
      component: {
        Button: {
          child: "submit-text",
          action: {
            name: "submit",
            context: choices.map((choice) => ({
              key: choice.id,
              value: { path: `/selections/${choice.id}` },
            })),
          },
        },
      },
    };
    allParts.push(submitButton);

    // Build the root column layout
    const rootComponent: v0_8.Types.ComponentInstance = {
      id: "root",
      component: {
        Column: {
          children: {
            explicitList: [...topLevelIds, ...checkboxIds, "submit-btn"],
          },
          distribution: "start",
          alignment: "stretch",
        },
      },
    };
    allParts.push(rootComponent);

    // Initialize selection state in data model (all unchecked)
    const dataInit: v0_8.Types.DataModelUpdate = {
      surfaceId,
      path: "/selections",
      contents: choices.map((choice) => ({
        key: choice.id,
        valueBoolean: false,
      })),
    };

    const messages: v0_8.Types.ServerToClientMessage[] = [
      { dataModelUpdate: dataInit },
      {
        surfaceUpdate: {
          surfaceId,
          components: allParts,
        },
      },
      {
        beginRendering: {
          surfaceId,
          root: "root",
        },
      },
    ];

    // Render the UI and await user input
    const rendering = this.renderUserInterface(messages);
    if (!ok(rendering)) return rendering;

    const userAction = await this.awaitUserInput();
    if (!ok(userAction)) return userAction;

    // Extract selected choices from the action context
    const context = userAction.userAction?.context;
    if (!context) {
      return err("No selections received");
    }

    const selected = choices
      .filter((choice) => context[choice.id] === true)
      .map((choice) => choice.id);

    return { selected };
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

  private renderUserInterface(
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

  private async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
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
