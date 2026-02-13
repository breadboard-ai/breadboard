/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as sidebarActions from "../../../../src/sca/actions/sidebar/sidebar-actions.js";
import { onSelectionChange } from "../../../../src/sca/actions/sidebar/triggers.js";
import type { AppController } from "../../../../src/sca/controller/controller.js";
import type { AppServices } from "../../../../src/sca/services/services.js";

suite("Sidebar Actions", () => {
  beforeEach(() => {
    coordination.reset();
  });

  suite("updateSidebarOnSelectionChange", () => {
    test("switches to editor when selection becomes non-empty", async () => {
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 2;
              },
            },
            sidebar: {
              get section() {
                return "preview";
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        "editor",
        "Should switch to editor when items are selected"
      );
    });

    test("switches to preview when selection becomes empty", async () => {
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 0;
              },
            },
            sidebar: {
              get section() {
                return "editor";
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        "preview",
        "Should switch to preview when nothing is selected"
      );
    });

    test("does not change section when already on editor with selection", async () => {
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 3;
              },
            },
            sidebar: {
              get section() {
                return "editor";
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        undefined,
        "Should not change section when already on editor"
      );
    });

    test("does not change section when on preview with no selection", async () => {
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 0;
              },
            },
            sidebar: {
              get section() {
                return "preview";
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        undefined,
        "Should not change section when already on preview with no selection"
      );
    });

    test("does not switch away from console even with selection", async () => {
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 0;
              },
            },
            sidebar: {
              get section() {
                return "console";
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        undefined,
        "Should not touch console section when deselecting"
      );
    });

    test("switches from edit-history to editor when selection appears", async () => {
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 1;
              },
            },
            sidebar: {
              get section() {
                return "edit-history";
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        "editor",
        "Should switch from edit-history to editor when items are selected"
      );
    });

    test("has runOnActivate set to true", () => {
      assert.strictEqual(
        sidebarActions.updateSidebarOnSelectionChange.runOnActivate,
        true,
        "Should have runOnActivate to reconcile persisted state on boot"
      );
    });

    test("reconciles persisted 'editor' section on boot when no selection", async () => {
      // Simulates the page refresh scenario: sidebar was persisted as
      // "editor" but no node is selected after reload.
      let sectionSet: string | undefined;

      sidebarActions.bind({
        services: {} as never,
        controller: {
          editor: {
            selection: {
              get size() {
                return 0; // No selection after refresh
              },
            },
            sidebar: {
              get section() {
                return "editor"; // Persisted value from localStorage
              },
              set section(val: string) {
                sectionSet = val;
              },
            },
          },
        } as never,
      });

      // This is what activateTriggers() does for runOnActivate actions
      await sidebarActions.updateSidebarOnSelectionChange();

      assert.strictEqual(
        sectionSet,
        "preview",
        "Should reset editor to preview when no selection exists on boot"
      );
    });
  });
});

// =============================================================================
// Sidebar Triggers
// =============================================================================

suite("Sidebar Triggers", () => {
  suite("onSelectionChange", () => {
    test("returns a signal trigger that reads selectionId", () => {
      let selectionIdValue = 42;

      const bind = {
        controller: {
          editor: {
            selection: {
              get selectionId() {
                return selectionIdValue;
              },
            },
          },
        } as unknown as AppController,
        services: {} as unknown as AppServices,
      };

      const trigger = onSelectionChange(bind);

      assert.strictEqual(trigger.type, "signal");
      assert.strictEqual(trigger.name, "Selection Change → Sidebar");

      // The condition should return the current selectionId
      assert.strictEqual(trigger.condition(), 42);

      // After changing selectionId, the condition should return the new value
      selectionIdValue = 99;
      assert.strictEqual(trigger.condition(), 99);
    });
  });
});
