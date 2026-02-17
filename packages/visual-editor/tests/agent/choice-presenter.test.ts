/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { deepStrictEqual, ok as assert, fail } from "node:assert";
import { ChoicePresenter } from "../../src/a2/agent/choice-presenter.js";
import { PidginTranslator } from "../../src/a2/agent/pidgin-translator.js";
import { AgentFileSystem } from "../../src/a2/agent/file-system.js";
import {
  stubMemoryManager,
  stubModuleArgs,
} from "../useful-stubs.js";
import { ok, err } from "@breadboard-ai/utils/outcome.js";
import type { LLMContent, Outcome } from "@breadboard-ai/types";
import type { v0_8 } from "../../src/a2ui/index.js";
import type { A2UIClientEventMessage } from "../../src/a2/agent/a2ui/schemas.js";

// Type for the UIRenderer interface
type UIRenderer = {
  renderUserInterface(
    messages: v0_8.Types.ServerToClientMessage[]
  ): Outcome<void>;
  awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>>;
};

// Helper to create a full userAction message
function makeUserAction(
  context: Record<string, unknown>
): A2UIClientEventMessage {
  return {
    userAction: {
      name: "test-action",
      surfaceId: "@choices",
      sourceComponentId: "test-component",
      timestamp: new Date().toISOString(),
      context,
    },
  };
}

// Helper to create a mock UIRenderer
function createMockRenderer(context?: Record<string, unknown>): UIRenderer & {
  capturedMessages: v0_8.Types.ServerToClientMessage[];
} {
  const captured: v0_8.Types.ServerToClientMessage[] = [];
  return {
    capturedMessages: captured,
    renderUserInterface(messages) {
      captured.push(...messages);
      return undefined as unknown as Outcome<void>; // success (void)
    },
    awaitUserInput() {
      return Promise.resolve(
        context ? makeUserAction(context) : { userAction: undefined }
      ) as Promise<Outcome<A2UIClientEventMessage>>;
    },
  };
}

// Helper to create a real translator
function createTranslator(): PidginTranslator {
  const fileSystem = new AgentFileSystem({
    context: stubModuleArgs.context,
    memoryManager: stubMemoryManager,
  });
  return new PidginTranslator(stubModuleArgs, fileSystem);
}

// Helper to find component by id in captured messages
function findComponent(
  capturedMessages: v0_8.Types.ServerToClientMessage[],
  id: string
): v0_8.Types.ComponentInstance | undefined {
  for (const msg of capturedMessages) {
    if ("surfaceUpdate" in msg && msg.surfaceUpdate) {
      const component = msg.surfaceUpdate.components?.find((c) => c.id === id);
      if (component) return component;
    }
  }
  return undefined;
}

// Helper to extract MultipleChoice properties from component
function getMultipleChoiceProps(component: v0_8.Types.ComponentInstance) {
  return (
    component.component as {
      MultipleChoice: {
        options: {
          label?: { literalString: string };
          value: string;
          child?: string;
        }[];
        maxAllowedSelections: number;
        selections: { path: string };
      };
    }
  ).MultipleChoice;
}

describe("ChoicePresenter", () => {
  describe("presentChoices - single selection mode", () => {
    it("returns selected choice ID when user selects an option", async () => {
      const mockRenderer = createMockRenderer({
        selections: ["option-b"],
      });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      const result = await presenter.presentChoices(
        "Choose one:",
        [
          { id: "option-a", label: "Option A" },
          { id: "option-b", label: "Option B" },
          { id: "option-c", label: "Option C" },
        ],
        "single"
      );

      if (!ok(result)) {
        fail(`Expected success, got error: ${result.$error}`);
      }
      deepStrictEqual(result.selected, ["option-b"]);
    });

    it("creates a MultipleChoice component with maxAllowedSelections=1", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick one:",
        [
          { id: "a", label: "First" },
          { id: "b", label: "Second" },
        ],
        "single"
      );

      // Verify MultipleChoice was created
      const multipleChoice = findComponent(
        mockRenderer.capturedMessages,
        "multiple-choice"
      );

      assert(multipleChoice !== undefined, "MultipleChoice should exist");
      assert(
        multipleChoice?.component &&
          "MultipleChoice" in multipleChoice.component,
        "Component should be a MultipleChoice"
      );

      const mc = getMultipleChoiceProps(multipleChoice!);
      deepStrictEqual(mc.maxAllowedSelections, 1);
      deepStrictEqual(mc.options.length, 2);
      deepStrictEqual(mc.options[0].value, "a");
      deepStrictEqual(mc.options[1].value, "b");
    });

    it("creates rich child components for each option", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [
          { id: "a", label: "First" },
          { id: "b", label: "Second" },
        ],
        "single"
      );

      // Verify child content containers exist
      const content0 = findComponent(
        mockRenderer.capturedMessages,
        "choice-content-0"
      );
      const content1 = findComponent(
        mockRenderer.capturedMessages,
        "choice-content-1"
      );

      assert(content0 !== undefined, "Choice content 0 should exist");
      assert(content1 !== undefined, "Choice content 1 should exist");

      // Verify MultipleChoice options reference children
      const multipleChoice = findComponent(
        mockRenderer.capturedMessages,
        "multiple-choice"
      );
      const mc = getMultipleChoiceProps(multipleChoice!);
      deepStrictEqual(mc.options[0].child, "choice-content-0");
      deepStrictEqual(mc.options[1].child, "choice-content-1");
    });

    it("creates a submit button for single mode", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [{ id: "a", label: "A" }],
        "single"
      );

      const submitBtn = findComponent(
        mockRenderer.capturedMessages,
        "submit-btn"
      );
      assert(submitBtn !== undefined, "Submit button should exist");
      assert(
        submitBtn?.component && "Button" in submitBtn.component,
        "Should be a Button"
      );
    });

    it("returns error when context is missing", async () => {
      // Create renderer that returns no userAction
      const failingRenderer: UIRenderer = {
        renderUserInterface: () => undefined as unknown as Outcome<void>,
        awaitUserInput: async () => ({ userAction: undefined }),
      };
      const presenter = new ChoicePresenter(
        createTranslator(),
        failingRenderer
      );

      const result = await presenter.presentChoices(
        "Choose:",
        [{ id: "x", label: "X" }],
        "single"
      );

      assert(!ok(result), "Should return error when no selections received");
      deepStrictEqual(result.$error, "No selections received");
    });

    it("uses Row for single-part choice content", async () => {
      const mockRenderer = createMockRenderer({ selections: ["simple"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [{ id: "simple", label: "Simple text" }],
        "single"
      );

      // For single-part content, should use Row
      const contentContainer = findComponent(
        mockRenderer.capturedMessages,
        "choice-content-0"
      );
      assert(
        contentContainer !== undefined,
        "Choice content container should exist"
      );
      assert(
        contentContainer?.component && "Row" in contentContainer.component,
        "Single-part content should use Row"
      );
    });
  });

  describe("presentChoices - multiple selection mode", () => {
    it("returns all selected choice IDs", async () => {
      const mockRenderer = createMockRenderer({
        selections: ["opt-1", "opt-3"],
      });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      const result = await presenter.presentChoices(
        "Select all that apply:",
        [
          { id: "opt-1", label: "Option 1" },
          { id: "opt-2", label: "Option 2" },
          { id: "opt-3", label: "Option 3" },
        ],
        "multiple"
      );

      if (!ok(result)) {
        fail(`Expected success, got error: ${result.$error}`);
      }
      deepStrictEqual(result.selected, ["opt-1", "opt-3"]);
    });

    it("returns empty array when nothing selected", async () => {
      const mockRenderer = createMockRenderer({
        selections: [],
      });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      const result = await presenter.presentChoices(
        "Select:",
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        "multiple"
      );

      if (!ok(result)) {
        fail(`Expected success, got error: ${result.$error}`);
      }
      deepStrictEqual(result.selected, []);
    });

    it("creates a MultipleChoice component", async () => {
      const mockRenderer = createMockRenderer({ selections: ["x"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Check all:",
        [
          { id: "x", label: "Check X" },
          { id: "y", label: "Check Y" },
        ],
        "multiple"
      );

      const multipleChoice = findComponent(
        mockRenderer.capturedMessages,
        "multiple-choice"
      );

      assert(multipleChoice !== undefined, "MultipleChoice should exist");
      assert(
        multipleChoice?.component &&
          "MultipleChoice" in multipleChoice.component,
        "Component should be a MultipleChoice"
      );

      const mc = getMultipleChoiceProps(multipleChoice!);
      deepStrictEqual(mc.options.length, 2);
      deepStrictEqual(mc.options[0].value, "x");
      deepStrictEqual(mc.options[1].value, "y");
      deepStrictEqual(mc.maxAllowedSelections, 2);
    });

    it("creates a submit button", async () => {
      const mockRenderer = createMockRenderer({});
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Select:",
        [{ id: "a", label: "A" }],
        "multiple"
      );

      const submitBtn = findComponent(
        mockRenderer.capturedMessages,
        "submit-btn"
      );
      const submitText = findComponent(
        mockRenderer.capturedMessages,
        "submit-text"
      );

      assert(submitBtn !== undefined, "Submit button should exist");
      assert(submitText !== undefined, "Submit text should exist");
      assert(
        submitBtn?.component && "Button" in submitBtn.component,
        "Should be a Button"
      );
      assert(
        submitText?.component && "Text" in submitText.component,
        "Should be a Text"
      );
    });

    it("initializes data model with empty selections array", async () => {
      const mockRenderer = createMockRenderer({ selections: [] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Select:",
        [
          { id: "first", label: "First" },
          { id: "second", label: "Second" },
        ],
        "multiple"
      );

      // Find the dataModelUpdate message
      const dataUpdate = mockRenderer.capturedMessages.find(
        (m) => "dataModelUpdate" in m
      );
      assert(dataUpdate !== undefined, "Data model update should exist");

      const update = (
        dataUpdate as {
          dataModelUpdate: {
            path: string;
            contents: { key: string; valueString: string }[];
          };
        }
      ).dataModelUpdate;
      deepStrictEqual(update.path, "/");
      deepStrictEqual(update.contents.length, 1);
      deepStrictEqual(update.contents[0].key, "selections");
      deepStrictEqual(update.contents[0].valueString, "[]");
    });

    it("returns error when context is missing", async () => {
      // Create renderer that returns no userAction
      const failingRenderer: UIRenderer = {
        renderUserInterface: () => undefined as unknown as Outcome<void>,
        awaitUserInput: async () => ({ userAction: undefined }),
      };
      const presenter = new ChoicePresenter(
        createTranslator(),
        failingRenderer
      );

      const result = await presenter.presentChoices(
        "Select:",
        [{ id: "a", label: "A" }],
        "multiple"
      );

      assert(!ok(result), "Should return error when context is missing");
      deepStrictEqual(result.$error, "No selections received");
    });

    it("sets maxAllowedSelections to choice count", async () => {
      const mockRenderer = createMockRenderer({ selections: [] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Check:",
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        "multiple"
      );

      const multipleChoice = findComponent(
        mockRenderer.capturedMessages,
        "multiple-choice"
      );
      assert(
        multipleChoice !== undefined,
        "MultipleChoice component should exist"
      );
      const mc = getMultipleChoiceProps(multipleChoice!);
      deepStrictEqual(mc.maxAllowedSelections, 3);
    });
  });

  describe("error handling", () => {
    it("propagates translator errors for message", async () => {
      const failingTranslator = {
        fromPidginString: async () => err("Translation failed"),
      } as unknown as PidginTranslator;

      const mockRenderer = createMockRenderer({});
      const presenter = new ChoicePresenter(failingTranslator, mockRenderer);

      const result = await presenter.presentChoices(
        "Message",
        [{ id: "a", label: "A" }],
        "single"
      );

      assert(!ok(result), "Should propagate translator error");
      deepStrictEqual(result.$error, "Translation failed");
    });

    it("propagates translator errors for choice labels", async () => {
      let callCount = 0;
      const partiallyFailingTranslator = {
        fromPidginString: async () => {
          callCount++;
          if (callCount === 1) {
            // First call (message) succeeds
            return { parts: [{ text: "Message" }] } as LLMContent;
          }
          // Second call (choice label) fails
          return err("Choice translation failed");
        },
      } as unknown as PidginTranslator;

      const mockRenderer = createMockRenderer({});
      const presenter = new ChoicePresenter(
        partiallyFailingTranslator,
        mockRenderer
      );

      const result = await presenter.presentChoices(
        "Message",
        [{ id: "a", label: "A" }],
        "single"
      );

      assert(!ok(result), "Should propagate translator error for choices");
      deepStrictEqual(result.$error, "Choice translation failed");
    });

    it("propagates renderer errors", async () => {
      const failingRenderer: UIRenderer = {
        renderUserInterface: () => err("Render failed"),
        awaitUserInput: async () => makeUserAction({}),
      };

      const presenter = new ChoicePresenter(
        createTranslator(),
        failingRenderer
      );

      const result = await presenter.presentChoices(
        "Message",
        [{ id: "a", label: "A" }],
        "single"
      );

      assert(!ok(result), "Should propagate renderer error");
      deepStrictEqual(result.$error, "Render failed");
    });

    it("propagates awaitUserInput errors", async () => {
      const failingRenderer: UIRenderer = {
        renderUserInterface: () => undefined as unknown as Outcome<void>,
        awaitUserInput: async () => err("User input failed"),
      };

      const presenter = new ChoicePresenter(
        createTranslator(),
        failingRenderer
      );

      const result = await presenter.presentChoices(
        "Message",
        [{ id: "a", label: "A" }],
        "single"
      );

      assert(!ok(result), "Should propagate awaitUserInput error");
      deepStrictEqual(result.$error, "User input failed");
    });
  });

  describe("UI structure", () => {
    it("creates root component with message and choices", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [{ id: "a", label: "A" }],
        "single"
      );

      const root = findComponent(mockRenderer.capturedMessages, "root");
      assert(root !== undefined, "Root component should exist");
      assert(
        root?.component && "Column" in root.component,
        "Root should be a Column"
      );

      const column = (
        root!.component as { Column: { children: { explicitList: string[] } } }
      ).Column;
      assert(
        column.children.explicitList.includes("multiple-choice"),
        "Should include multiple-choice component"
      );
      assert(
        column.children.explicitList.includes("button-row"),
        "Should include button row"
      );
    });

    it("sends beginRendering message with correct surfaceId", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [{ id: "a", label: "A" }],
        "single"
      );

      const beginRenderingMsg = mockRenderer.capturedMessages.find(
        (m) => "beginRendering" in m
      );
      assert(
        beginRenderingMsg !== undefined,
        "beginRendering message should exist"
      );

      const rendering = (
        beginRenderingMsg as {
          beginRendering: { surfaceId: string; root: string };
        }
      ).beginRendering;
      deepStrictEqual(rendering.surfaceId, "@choices");
      deepStrictEqual(rendering.root, "root");
    });

    it("uses @choices as surfaceId", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Message",
        [{ id: "a", label: "A" }],
        "single"
      );

      const surfaceUpdate = mockRenderer.capturedMessages.find(
        (m) => "surfaceUpdate" in m
      );
      assert(surfaceUpdate !== undefined, "surfaceUpdate message should exist");

      const update = (surfaceUpdate as { surfaceUpdate: { surfaceId: string } })
        .surfaceUpdate;
      deepStrictEqual(update.surfaceId, "@choices");
    });

    it("initializes data model for single selection mode", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [{ id: "a", label: "A" }],
        "single"
      );

      const dataUpdate = mockRenderer.capturedMessages.find(
        (m) => "dataModelUpdate" in m
      );
      assert(
        dataUpdate !== undefined,
        "Data model update should exist for single mode"
      );
    });
  });

  describe("presentChoices - none_of_the_above_label", () => {
    it("creates a non-primary Button when noneOfTheAboveLabel is provided", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick one:",
        [{ id: "a", label: "Option A" }],
        "single",
        "list",
        "Skip"
      );

      // The "none of the above" should NOT be in the MultipleChoice options
      const multipleChoice = findComponent(
        mockRenderer.capturedMessages,
        "multiple-choice"
      );
      assert(
        multipleChoice !== undefined,
        "MultipleChoice component should exist"
      );
      const mc = getMultipleChoiceProps(multipleChoice!);
      deepStrictEqual(
        mc.options.length,
        1,
        "MultipleChoice should only have the real options"
      );

      // It should be a separate Button component
      const noneBtn = findComponent(
        mockRenderer.capturedMessages,
        "none-of-the-above-btn"
      );
      assert(noneBtn !== undefined, "None-of-the-above button should exist");
      assert(
        noneBtn?.component && "Button" in noneBtn.component,
        "Should be a Button"
      );

      const btnProps = (
        noneBtn!.component as {
          Button: {
            primary: boolean;
            action: {
              name: string;
              context: { key: string; value: { literalString: string } }[];
            };
          };
        }
      ).Button;
      deepStrictEqual(btnProps.primary, false, "Should be non-primary");
      deepStrictEqual(btnProps.action.name, "submit");
      deepStrictEqual(
        btnProps.action.context[0].value.literalString,
        JSON.stringify(["__none_of_the_above__"])
      );

      // Verify the text child has the label
      const noneText = findComponent(
        mockRenderer.capturedMessages,
        "none-of-the-above-text"
      );
      assert(noneText !== undefined, "None-of-the-above text should exist");
      const textProps = (
        noneText!.component as {
          Text: { text: { literalString: string } };
        }
      ).Text;
      deepStrictEqual(textProps.text.literalString, "Skip");
    });

    it("returns __none_of_the_above__ ID when none button is clicked", async () => {
      const mockRenderer = createMockRenderer({
        selections: ["__none_of_the_above__"],
      });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      const result = await presenter.presentChoices(
        "Pick one:",
        [{ id: "a", label: "Option A" }],
        "single",
        "list",
        "Exit"
      );

      if (!ok(result)) {
        fail(`Expected success, got error: ${result.$error}`);
      }
      deepStrictEqual(result.selected, ["__none_of_the_above__"]);
    });

    it("does not create none button when noneOfTheAboveLabel is not provided", async () => {
      const mockRenderer = createMockRenderer({ selections: ["a"] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick one:",
        [{ id: "a", label: "Option A" }],
        "single"
      );

      const noneBtn = findComponent(
        mockRenderer.capturedMessages,
        "none-of-the-above-btn"
      );
      deepStrictEqual(noneBtn, undefined, "None button should not exist");

      const multipleChoice = findComponent(
        mockRenderer.capturedMessages,
        "multiple-choice"
      );
      const mc = getMultipleChoiceProps(multipleChoice!);
      deepStrictEqual(mc.options.length, 1);
    });

    it("includes none-of-the-above-btn in root layout", async () => {
      const mockRenderer = createMockRenderer({ selections: [] });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Select:",
        [{ id: "a", label: "Option A" }],
        "multiple",
        "list",
        "None apply"
      );

      const buttonRow = findComponent(
        mockRenderer.capturedMessages,
        "button-row"
      );
      assert(buttonRow !== undefined, "Button row should exist");
      const row = (
        buttonRow!.component as {
          Row: { children: { explicitList: string[] } };
        }
      ).Row;
      assert(
        row.children.explicitList.includes("none-of-the-above-btn"),
        "Button row should include none-of-the-above button"
      );
      assert(
        row.children.explicitList.includes("submit-btn"),
        "Button row should include submit button"
      );
    });
  });
});
