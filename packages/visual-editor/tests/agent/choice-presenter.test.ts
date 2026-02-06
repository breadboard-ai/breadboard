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
  stubCaps,
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
  return new PidginTranslator(stubCaps, stubModuleArgs, fileSystem);
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

describe("ChoicePresenter", () => {
  describe("presentChoices - single selection mode", () => {
    it("returns selected choice ID when user clicks a button", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "option-b" });
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

    it("creates buttons for each choice", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "a" });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick one:",
        [
          { id: "a", label: "First" },
          { id: "b", label: "Second" },
        ],
        "single"
      );

      // Verify buttons were created
      const buttonA = findComponent(
        mockRenderer.capturedMessages,
        "choice-btn-0"
      );
      const buttonB = findComponent(
        mockRenderer.capturedMessages,
        "choice-btn-1"
      );

      assert(buttonA !== undefined, "Button 0 should exist");
      assert(buttonB !== undefined, "Button 1 should exist");
      assert(
        buttonA?.component && "Button" in buttonA.component,
        "Component should be a Button"
      );
      assert(
        buttonB?.component && "Button" in buttonB.component,
        "Component should be a Button"
      );
    });

    it("returns error when no choice is selected", async () => {
      const mockRenderer = createMockRenderer({}); // No choiceId
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      const result = await presenter.presentChoices(
        "Choose:",
        [{ id: "x", label: "X" }],
        "single"
      );

      assert(!ok(result), "Should return error when no choice selected");
      deepStrictEqual(result.$error, "No choice was selected");
    });

    it("uses list layout by default (Column container)", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "a" });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        "single"
      );

      const container = findComponent(
        mockRenderer.capturedMessages,
        "choices-container"
      );
      assert(container !== undefined, "Choices container should exist");
      assert(
        container?.component && "Column" in container.component,
        "Default layout should be Column"
      );
    });

    it("uses Row container for 'row' layout", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "a" });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [
          { id: "a", label: "Yes" },
          { id: "b", label: "No" },
        ],
        "single",
        "row"
      );

      const container = findComponent(
        mockRenderer.capturedMessages,
        "choices-container"
      );
      assert(container !== undefined, "Choices container should exist");
      assert(
        container?.component && "Row" in container.component,
        "Row layout should use Row component"
      );

      // Verify alignment for row
      const row = (container!.component as { Row: { alignment?: string } }).Row;
      deepStrictEqual(row.alignment, "center");
    });

    it("uses Row container for 'grid' layout", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "a" });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Pick:",
        [
          { id: "a", label: "1" },
          { id: "b", label: "2" },
        ],
        "single",
        "grid"
      );

      const container = findComponent(
        mockRenderer.capturedMessages,
        "choices-container"
      );
      assert(container !== undefined, "Choices container should exist");
      assert(
        container?.component && "Row" in container.component,
        "Grid layout should use Row component"
      );

      // Verify alignment for grid (start, not center)
      const row = (container!.component as { Row: { alignment?: string } }).Row;
      deepStrictEqual(row.alignment, "start");
    });

    it("uses Row for single-part choice content", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "simple" });
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
        "opt-1": true,
        "opt-2": false,
        "opt-3": true,
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
        a: false,
        b: false,
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

    it("creates checkboxes for each choice", async () => {
      const mockRenderer = createMockRenderer({ x: true });
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Check all:",
        [
          { id: "x", label: "Check X" },
          { id: "y", label: "Check Y" },
        ],
        "multiple"
      );

      const checkboxX = findComponent(
        mockRenderer.capturedMessages,
        "choice-checkbox-0"
      );
      const checkboxY = findComponent(
        mockRenderer.capturedMessages,
        "choice-checkbox-1"
      );

      assert(checkboxX !== undefined, "Checkbox 0 should exist");
      assert(checkboxY !== undefined, "Checkbox 1 should exist");
      assert(
        checkboxX?.component && "CheckBox" in checkboxX.component,
        "Component should be a CheckBox"
      );
      assert(
        checkboxY?.component && "CheckBox" in checkboxY.component,
        "Component should be a CheckBox"
      );
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

    it("initializes data model with unchecked state", async () => {
      const mockRenderer = createMockRenderer({});
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
            contents: { key: string; valueBoolean: boolean }[];
          };
        }
      ).dataModelUpdate;
      deepStrictEqual(update.path, "/selections");
      deepStrictEqual(update.contents.length, 2);
      deepStrictEqual(update.contents[0].key, "first");
      deepStrictEqual(update.contents[0].valueBoolean, false);
      deepStrictEqual(update.contents[1].key, "second");
      deepStrictEqual(update.contents[1].valueBoolean, false);
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

    it("uses list layout by default for checkboxes", async () => {
      const mockRenderer = createMockRenderer({});
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Check:",
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        "multiple"
      );

      const container = findComponent(
        mockRenderer.capturedMessages,
        "choices-container"
      );
      assert(container !== undefined, "Choices container should exist");
      assert(
        container?.component && "Column" in container.component,
        "Default layout should be Column"
      );
    });

    it("uses Row container for 'row' layout", async () => {
      const mockRenderer = createMockRenderer({});
      const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

      await presenter.presentChoices(
        "Check:",
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        "multiple",
        "row"
      );

      const container = findComponent(
        mockRenderer.capturedMessages,
        "choices-container"
      );
      assert(container !== undefined, "Choices container should exist");
      assert(
        container?.component && "Row" in container.component,
        "Row layout should use Row component"
      );
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
      const mockRenderer = createMockRenderer({ choiceId: "a" });
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
        column.children.explicitList.includes("choices-container"),
        "Should include choices container"
      );
    });

    it("sends beginRendering message with correct surfaceId", async () => {
      const mockRenderer = createMockRenderer({ choiceId: "a" });
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
      const mockRenderer = createMockRenderer({ choiceId: "a" });
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
  });

  describe("presentChoices - none_of_the_above_label", () => {
    describe("single selection mode", () => {
      it("renders separator and secondary button when noneOfTheAboveLabel is provided", async () => {
        const mockRenderer = createMockRenderer({ choiceId: "a" });
        const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

        await presenter.presentChoices(
          "Pick one:",
          [{ id: "a", label: "Option A" }],
          "single",
          "list",
          "Skip"
        );

        // Verify separator exists
        const separator = findComponent(
          mockRenderer.capturedMessages,
          "none-separator"
        );
        assert(separator !== undefined, "Separator should exist");
        assert(
          separator?.component && "Divider" in separator.component,
          "Should be a Divider"
        );

        // Verify secondary button exists
        const noneBtn = findComponent(
          mockRenderer.capturedMessages,
          "none-btn"
        );
        assert(noneBtn !== undefined, "None button should exist");
        assert(
          noneBtn?.component && "Button" in noneBtn.component,
          "Should be a Button"
        );
        const button = (noneBtn!.component as { Button: { variant?: string } })
          .Button;
        deepStrictEqual(button.variant, "secondary");
      });

      it("returns __none_of_the_above__ ID when none button is selected", async () => {
        const mockRenderer = createMockRenderer({
          choiceId: "__none_of_the_above__",
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

      it("does not render separator or none button when noneOfTheAboveLabel is not provided", async () => {
        const mockRenderer = createMockRenderer({ choiceId: "a" });
        const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

        await presenter.presentChoices(
          "Pick one:",
          [{ id: "a", label: "Option A" }],
          "single"
        );

        const separator = findComponent(
          mockRenderer.capturedMessages,
          "none-separator"
        );
        const noneBtn = findComponent(
          mockRenderer.capturedMessages,
          "none-btn"
        );

        deepStrictEqual(separator, undefined, "Separator should not exist");
        deepStrictEqual(noneBtn, undefined, "None button should not exist");
      });
    });

    describe("multiple selection mode", () => {
      it("renders separator and checkbox when noneOfTheAboveLabel is provided", async () => {
        const mockRenderer = createMockRenderer({
          a: false,
          __none_of_the_above__: false,
        });
        const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

        await presenter.presentChoices(
          "Select all:",
          [{ id: "a", label: "Option A" }],
          "multiple",
          "list",
          "None apply"
        );

        // Verify separator exists
        const separator = findComponent(
          mockRenderer.capturedMessages,
          "none-separator"
        );
        assert(separator !== undefined, "Separator should exist");

        // Verify checkbox exists
        const noneCheckbox = findComponent(
          mockRenderer.capturedMessages,
          "none-checkbox"
        );
        assert(noneCheckbox !== undefined, "None checkbox should exist");
        assert(
          noneCheckbox?.component && "CheckBox" in noneCheckbox.component,
          "Should be a CheckBox"
        );
      });

      it("includes __none_of_the_above__ in selections when checked", async () => {
        const mockRenderer = createMockRenderer({
          a: true,
          __none_of_the_above__: true,
        });
        const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

        const result = await presenter.presentChoices(
          "Select all:",
          [{ id: "a", label: "Option A" }],
          "multiple",
          "list",
          "None apply"
        );

        if (!ok(result)) {
          fail(`Expected success, got error: ${result.$error}`);
        }
        deepStrictEqual(result.selected, ["a", "__none_of_the_above__"]);
      });

      it("initializes none_of_the_above in data model as unchecked", async () => {
        const mockRenderer = createMockRenderer({});
        const presenter = new ChoicePresenter(createTranslator(), mockRenderer);

        await presenter.presentChoices(
          "Select:",
          [{ id: "a", label: "A" }],
          "multiple",
          "list",
          "Skip"
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
              contents: { key: string; valueBoolean: boolean }[];
            };
          }
        ).dataModelUpdate;

        // Should include both regular choice and none_of_the_above
        deepStrictEqual(update.contents.length, 2);
        const noneEntry = update.contents.find(
          (c) => c.key === "__none_of_the_above__"
        );
        assert(noneEntry !== undefined, "None of the above should be in data");
        deepStrictEqual(noneEntry!.valueBoolean, false);
      });
    });
  });
});
