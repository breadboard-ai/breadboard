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
   * For "single" mode: renders choice buttons - clicking one returns that ID.
   * For "multiple" mode: renders checkboxes with a submit button.
   *
   * Both message and choice labels support pidgin format with file references.
   */
  async presentChoices(
    message: string,
    choices: ChatChoice[],
    selectionMode: ChatChoiceSelectionMode,
    layout: ChatChoiceLayout = "list",
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

    if (selectionMode === "single") {
      return this.#presentSingleChoice(
        messageContent,
        translatedChoices,
        surfaceId,
        layout,
        noneOfTheAboveLabel
      );
    } else {
      return this.#presentMultipleChoice(
        messageContent,
        translatedChoices,
        surfaceId,
        layout,
        noneOfTheAboveLabel
      );
    }
  }

  /**
   * Builds a container component for choices based on layout.
   * - "list": Column (vertical stack)
   * - "row": Row (horizontal inline)
   * - "grid": Row with flex-wrap (adapts to space)
   *
   * @param stretchToFill - If true, stretch items to fill available space (for complex content)
   */
  #buildChoicesContainer(
    id: string,
    childIds: string[],
    layout: ChatChoiceLayout,
    stretchToFill: boolean = false
  ): v0_8.Types.ComponentInstance {
    switch (layout) {
      case "row":
        return {
          id,
          component: {
            Row: {
              children: { explicitList: childIds },
              distribution: "start",
              alignment: stretchToFill ? "stretch" : "center",
            },
          },
        };
      case "grid":
        // Row with wrap behavior - using custom styles for flex-wrap
        return {
          id,
          component: {
            Row: {
              children: { explicitList: childIds },
              distribution: "start",
              alignment: stretchToFill ? "stretch" : "start",
            },
          },
          // Note: flex-wrap would need custom CSS or A2UI extension
          // For now, treating grid same as row but could be enhanced
        };
      case "list":
      default:
        return {
          id,
          component: {
            Column: {
              children: { explicitList: childIds },
              distribution: "start",
              alignment: "stretch",
            },
          },
        };
    }
  }

  async #presentSingleChoice(
    messageContent: LLMContent,
    choices: { id: string; content: LLMContent }[],
    surfaceId: string,
    layout: ChatChoiceLayout,
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

    // Build buttons for each choice
    // Track if any choice has complex content (multi-part) to determine layout behavior
    const buttonIds: string[] = [];
    let hasComplexContent = false;

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const choiceComponents = llmContentToA2UIComponents(choice.content, {
        idPrefix: `choice-${i}`,
      });
      allParts.push(...choiceComponents.parts);

      // Create container for the choice content
      // Use Column when there are multiple parts (e.g., image + text) for stacked layout
      // Use Row for single-part content
      const choiceContentId = `choice-content-${i}`;
      const useStacked = choiceComponents.ids.length > 1;
      if (useStacked) {
        hasComplexContent = true;
      }

      allParts.push({
        id: choiceContentId,
        component: useStacked
          ? {
              Column: {
                children: { explicitList: choiceComponents.ids },
                alignment: "center",
                distribution: "start",
              },
            }
          : {
              Row: {
                children: { explicitList: choiceComponents.ids },
              },
            },
      });

      // Create button wrapping the choice content
      // For row/grid layout with complex content, give buttons equal weight
      const buttonId = `choice-btn-${i}`;
      const buttonComponent: v0_8.Types.ComponentInstance = {
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
      };
      buttonIds.push(buttonId);
      allParts.push(buttonComponent);
    }

    // Apply weights for equal sizing only when content is complex
    if (hasComplexContent && (layout === "row" || layout === "grid")) {
      for (const part of allParts) {
        if (buttonIds.includes(part.id)) {
          part.weight = 1;
        }
      }
    }

    // Build the choices container based on layout
    // Use stretch alignment only for complex content (cards with images)
    const choicesContainerId = "choices-container";
    const choicesContainer = this.#buildChoicesContainer(
      choicesContainerId,
      buttonIds,
      layout,
      hasComplexContent
    );
    allParts.push(choicesContainer);

    // Build the "none of the above" section if provided
    const noneOfTheAboveIds: string[] = [];
    if (noneOfTheAboveLabel) {
      // Add a separator
      const separatorId = "none-separator";
      allParts.push({
        id: separatorId,
        component: {
          Divider: {},
        },
      });
      noneOfTheAboveIds.push(separatorId);

      // Create text for the "none" button
      const noneTextId = "none-text";
      allParts.push({
        id: noneTextId,
        component: {
          Text: {
            text: { literalString: noneOfTheAboveLabel },
            usageHint: "body",
          },
        },
      });

      // Create secondary-styled button for "none of the above"
      const noneButtonId = "none-btn";
      allParts.push({
        id: noneButtonId,
        component: {
          Button: {
            child: noneTextId,
            variant: "secondary",
            action: {
              name: "select",
              context: [
                {
                  key: "choiceId",
                  value: { literalString: NONE_OF_THE_ABOVE_ID },
                },
              ],
            },
          },
        },
      });
      noneOfTheAboveIds.push(noneButtonId);
    }

    // Build the root column layout (message on top, choices below, optional "none" section)
    const rootComponent: v0_8.Types.ComponentInstance = {
      id: "root",
      weight: 1,
      component: {
        Column: {
          children: {
            explicitList: [
              ...topLevelIds,
              choicesContainerId,
              ...noneOfTheAboveIds,
            ],
          },
          distribution: "center",
          alignment: "center",
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
    const rendering = this.#renderer.renderUserInterface(
      messages,
      "Presenting choices",
      "list"
    );
    if (!ok(rendering)) return rendering;

    const userAction = await this.#renderer.awaitUserInput();
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
    surfaceId: string,
    layout: ChatChoiceLayout,
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

    // Build the choices container based on layout
    const choicesContainerId = "choices-container";
    const choicesContainer = this.#buildChoicesContainer(
      choicesContainerId,
      checkboxIds,
      layout
    );
    allParts.push(choicesContainer);

    // Build the "none of the above" section if provided
    const noneOfTheAboveIds: string[] = [];
    if (noneOfTheAboveLabel) {
      // Add a separator
      const separatorId = "none-separator";
      allParts.push({
        id: separatorId,
        component: {
          Divider: {},
        },
      });
      noneOfTheAboveIds.push(separatorId);

      // Add checkbox for "none of the above"
      const noneCheckboxId = "none-checkbox";
      allParts.push({
        id: noneCheckboxId,
        component: {
          CheckBox: {
            label: { literalString: noneOfTheAboveLabel },
            value: { path: `/selections/${NONE_OF_THE_ABOVE_ID}` },
          },
        },
      });
      noneOfTheAboveIds.push(noneCheckboxId);
    }

    // Build the root column layout (message, choices, submit button)
    const rootComponent: v0_8.Types.ComponentInstance = {
      id: "root",
      weight: 1,
      component: {
        Column: {
          children: {
            explicitList: [
              ...topLevelIds,
              choicesContainerId,
              ...noneOfTheAboveIds,
              "submit-btn",
            ],
          },
          distribution: "center",
          alignment: "center",
        },
      },
    };
    allParts.push(rootComponent);

    // Initialize selection state in data model (all unchecked)
    const dataContents = choices.map((choice) => ({
      key: choice.id,
      valueBoolean: false,
    }));
    // Add none-of-the-above to data model if provided
    if (noneOfTheAboveLabel) {
      dataContents.push({
        key: NONE_OF_THE_ABOVE_ID,
        valueBoolean: false,
      });
    }
    const dataInit: v0_8.Types.DataModelUpdate = {
      surfaceId,
      path: "/selections",
      contents: dataContents,
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

    // Build list of all choice IDs (including none-of-the-above if present)
    const allChoiceIds = choices.map((choice) => choice.id);
    if (noneOfTheAboveLabel) {
      allChoiceIds.push(NONE_OF_THE_ABOVE_ID);
    }

    const selected = allChoiceIds.filter((id) => context[id] === true);

    return { selected };
  }
}
