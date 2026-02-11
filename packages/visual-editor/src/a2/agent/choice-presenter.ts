/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { v0_8 } from "../../a2ui/index.js";
import { isTextCapabilityPart } from "../../data/common.js";
import { A2UIClientEventMessage } from "./a2ui/schemas.js";
import { llmContentToA2UIComponents } from "./llm-content-to-a2ui.js";
import { PidginTranslator } from "./pidgin-translator.js";
import {
  ChatChoice,
  ChatChoiceLayout,
  ChatChoicesResponse,
  ChatChoiceSelectionMode,
} from "./types.js";

export { ChoicePresenter, NONE_OF_THE_ABOVE_ID };

const NONE_OF_THE_ABOVE_ID = "__none_of_the_above__";

/**
 * Interface for the UI rendering capabilities needed by ChoicePresenter.
 */
type UIRenderer = {
  renderUserInterface(
    messages: v0_8.Types.ServerToClientMessage[],
    title?: string,
    icon?: string
  ): Outcome<void>;
  awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>>;
};

/**
 * Handles presenting choices to users via A2UI.
 *
 * Supports:
 * - Single selection (buttons) and multiple selection (checkboxes)
 * - Layout options: list (vertical), row (horizontal), grid (wrapping)
 * - Rich content in choice labels (images, files via pidgin strings)
 */
class ChoicePresenter {
  readonly #translator: PidginTranslator;
  readonly #renderer: UIRenderer;

  constructor(translator: PidginTranslator, renderer: UIRenderer) {
    this.#translator = translator;
    this.#renderer = renderer;
  }

  /**
   * Presents choices to the user and returns the selected choice IDs.
   *
   * Both single and multiple selection modes use the MultipleChoice component.
   * Single mode sets `maxAllowedSelections: 1`.
   *
   * Choice labels support rich content: each choice's LLMContent is converted
   * to a component tree and referenced via the option's `child` property.
   */
  async presentChoices(
    message: string,
    choices: ChatChoice[],
    selectionMode: ChatChoiceSelectionMode,
    _layout: ChatChoiceLayout = "list",
    noneOfTheAboveLabel?: string
  ): Promise<Outcome<ChatChoicesResponse>> {
    const surfaceId = "@choices";

    // Translate pidgin strings to LLMContent
    const messageContent = await this.#translator.fromPidginString(message);
    if (!ok(messageContent)) return messageContent;

    const translatedChoices: { id: string; content: LLMContent }[] = [];
    for (const choice of choices) {
      const labelContent = await this.#translator.fromPidginString(
        choice.label
      );
      if (!ok(labelContent)) return labelContent;
      translatedChoices.push({ id: choice.id, content: labelContent });
    }

    return this.#presentChoicesAsMultipleChoice(
      messageContent,
      translatedChoices,
      surfaceId,
      selectionMode,
      noneOfTheAboveLabel
    );
  }

  async #presentChoicesAsMultipleChoice(
    messageContent: LLMContent,
    choices: { id: string; content: LLMContent }[],
    surfaceId: string,
    selectionMode: ChatChoiceSelectionMode,
    noneOfTheAboveLabel?: string
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

    // Build the options list for the MultipleChoice component.
    // Each option's LLMContent is converted to a component tree
    // and referenced via the `child` property.
    const multipleChoiceOptions: {
      label?: { literalString: string };
      value: string;
      child?: string;
    }[] = [];

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const choiceComponents = llmContentToA2UIComponents(choice.content, {
        idPrefix: `choice-${i}`,
      });
      allParts.push(...choiceComponents.parts);

      // Build a container for the choice content
      const choiceContentId = `choice-content-${i}`;
      const useStacked = choiceComponents.ids.length > 1;

      allParts.push({
        id: choiceContentId,
        component: useStacked
          ? {
              Column: {
                children: { explicitList: choiceComponents.ids },
                alignment: "stretch",
                distribution: "start",
              },
            }
          : {
              Row: {
                children: { explicitList: choiceComponents.ids },
              },
            },
      });

      // Extract text for the label as a fallback
      const textPart = choice.content.parts.find(isTextCapabilityPart);
      const labelText = textPart?.text.trim() ?? `Choice ${choice.id}`;

      multipleChoiceOptions.push({
        label: { literalString: labelText },
        value: choice.id,
        child: choiceContentId,
      });
    }

    // Include "none of the above" as an option if provided.
    if (noneOfTheAboveLabel) {
      multipleChoiceOptions.push({
        label: { literalString: noneOfTheAboveLabel },
        value: NONE_OF_THE_ABOVE_ID,
      });
    }

    // Build the native MultipleChoice component.
    const multipleChoiceId = "multiple-choice";
    allParts.push({
      id: multipleChoiceId,
      component: {
        MultipleChoice: {
          options: multipleChoiceOptions,
          selections: { path: "/selections" },
          maxAllowedSelections: selectionMode === "single" ? 1 : choices.length,
        },
      },
    });
    topLevelIds.push(multipleChoiceId);

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
            context: [
              {
                key: "selections",
                value: { path: "/selections" },
              },
            ],
          },
        },
      },
    };
    allParts.push(submitButton);

    // Build the root column layout (message, multiple choice, submit button)
    const rootComponent: v0_8.Types.ComponentInstance = {
      id: "root",
      weight: 1,
      component: {
        Column: {
          children: {
            explicitList: [...topLevelIds, "submit-btn"],
          },
          distribution: "center",
          alignment: "center",
        },
      },
    };
    allParts.push(rootComponent);

    // Initialize selection state in data model (empty array)
    const dataInit: v0_8.Types.DataModelUpdate = {
      surfaceId,
      path: "/",
      contents: [
        {
          key: "selections",
          valueString: "[]",
        },
      ],
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
    const rendering = this.#renderer.renderUserInterface(
      messages,
      "Presenting choices",
      "list"
    );
    if (!ok(rendering)) return rendering;

    const userAction = await this.#renderer.awaitUserInput();
    if (!ok(userAction)) return userAction;

    // Extract selected choices from the action context
    const context = userAction.userAction?.context;
    if (!context) {
      return err("No selections received");
    }

    // The selections come back as an array of choice IDs
    const selections = context.selections;
    if (Array.isArray(selections)) {
      return { selected: selections as string[] };
    }

    // Fallback: if selections is not an array, return empty
    return { selected: [] };
  }
}
