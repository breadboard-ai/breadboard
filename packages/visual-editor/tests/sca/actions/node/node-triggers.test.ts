/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  onNodeConfigChange,
  onCopyShortcut,
} from "../../../../src/sca/actions/node/triggers.js";
import { setDOM, unsetDOM } from "../../../fake-dom.js";

suite("Node Triggers", () => {
  suite("onNodeConfigChange", () => {
    test("returns true when config change exists", () => {
      const configChange = { nodeId: "node-123", config: { foo: "bar" } };
      const mockBind = {
        controller: {
          editor: {
            graph: {
              lastNodeConfigChange: configChange,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        true,
        "Should return true when config change exists"
      );
    });

    test("returns false when no config change", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              lastNodeConfigChange: null,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when no config change"
      );
    });

    test("returns false when lastNodeConfigChange is undefined", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              lastNodeConfigChange: undefined,
            },
          },
        },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when undefined");
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { editor: { graph: { lastNodeConfigChange: null } } },
        services: {},
      };

      const trigger = onNodeConfigChange(mockBind as never);

      assert.strictEqual(trigger.name, "Node Config Change");
    });
  });

  suite("onCopyShortcut", () => {
    beforeEach(() => {
      setDOM();
    });

    afterEach(() => {
      unsetDOM();
    });

    test("has correct trigger name and keys", () => {
      const trigger = onCopyShortcut();

      assert.strictEqual(trigger.name, "Copy Shortcut");
      assert.deepStrictEqual(trigger.keys, ["Cmd+c", "Ctrl+c"]);
      assert.strictEqual(trigger.type, "keyboard");
    });

    test("guard returns false when text is selected", () => {
      const trigger = onCopyShortcut();
      assert.ok(trigger.guard, "trigger should have a guard");

      // Mock window.getSelection to return a non-empty selection
      const mockSelection = {
        toString: () => "some selected text",
      };
      const getSelectionSpy = mock.method(
        globalThis.window as Window & typeof globalThis,
        "getSelection",
        () => mockSelection as unknown as Selection
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evt = new (globalThis as any).window.KeyboardEvent("keydown", {
        key: "c",
        metaKey: true,
      });
      const result = trigger.guard!(evt);

      assert.strictEqual(
        result,
        false,
        "should return false when text is selected"
      );

      getSelectionSpy.mock.restore();
    });

    test("guard defers to isFocusedOnGraphRenderer when no text selected", () => {
      const trigger = onCopyShortcut();
      assert.ok(trigger.guard, "trigger should have a guard");

      // Mock window.getSelection to return empty selection
      const mockSelection = {
        toString: () => "",
      };
      const getSelectionSpy = mock.method(
        globalThis.window as Window & typeof globalThis,
        "getSelection",
        () => mockSelection as unknown as Selection
      );

      // When no text is selected, guard should call isFocusedOnGraphRenderer.
      // That function checks for a bb-graph-renderer in the event's composed
      // path, which doesn't exist here, so it should return false.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evt = new (globalThis as any).window.KeyboardEvent("keydown", {
        key: "c",
        metaKey: true,
      });
      const result = trigger.guard!(evt);

      // No bb-graph-renderer in composed path → isFocusedOnGraphRenderer returns false
      assert.strictEqual(
        result,
        false,
        "should return false when no renderer is in the event path"
      );

      getSelectionSpy.mock.restore();
    });

    test("guard returns false when getSelection returns null", () => {
      const trigger = onCopyShortcut();
      assert.ok(trigger.guard, "trigger should have a guard");

      const getSelectionSpy = mock.method(
        globalThis.window as Window & typeof globalThis,
        "getSelection",
        () => null
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evt = new (globalThis as any).window.KeyboardEvent("keydown", {
        key: "c",
        metaKey: true,
      });
      const result = trigger.guard!(evt);

      // null selection → no text selected → falls through to isFocusedOnGraphRenderer
      // → no renderer in path → false
      assert.strictEqual(
        result,
        false,
        "should return false when getSelection returns null"
      );

      getSelectionSpy.mock.restore();
    });
  });
});
