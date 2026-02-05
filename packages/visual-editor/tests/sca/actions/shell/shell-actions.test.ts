/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { coordination } from "../../../../src/sca/coordination.js";
import * as shellActions from "../../../../src/sca/actions/shell/shell-actions.js";

suite("Shell Actions", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    coordination.reset();
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  suite("updatePageTitle", () => {
    test("sets page title with graph title when present", async () => {
      let capturedTitle = "";

      // Mock window.document.title - the action uses window.document.title
      const mockWindow = {
        document: {
          get title() {
            return capturedTitle;
          },
          set title(val: string) {
            capturedTitle = val;
          },
        },
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      shellActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              title: "My Test Board",
            },
          },
        } as never,
      });

      await shellActions.updatePageTitle();

      // Title should include the graph title
      assert.ok(
        capturedTitle.includes("My Test Board"),
        `Expected title to include 'My Test Board', got: ${capturedTitle}`
      );
      assert.ok(
        capturedTitle.includes(" - "),
        `Expected title to have separator, got: ${capturedTitle}`
      );
    });

    test("sets default title when graph title is empty", async () => {
      let capturedTitle = "";

      const mockWindow = {
        document: {
          get title() {
            return capturedTitle;
          },
          set title(val: string) {
            capturedTitle = val;
          },
        },
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      shellActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              title: "",
            },
          },
        } as never,
      });

      await shellActions.updatePageTitle();

      // Title should not include separator when no graph title (just suffix)
      assert.ok(capturedTitle.length > 0, "Title should be set");
      // When title is empty, it should just be the suffix
      assert.ok(!capturedTitle.includes(" - ") || capturedTitle.startsWith(" - ") === false,
        "Title should not have graph title prefix");
    });

    test("trims whitespace from graph title", async () => {
      let capturedTitle = "";

      const mockWindow = {
        document: {
          get title() {
            return capturedTitle;
          },
          set title(val: string) {
            capturedTitle = val;
          },
        },
      };
      Object.defineProperty(globalThis, "window", {
        value: mockWindow,
        writable: true,
        configurable: true,
      });

      shellActions.bind({
        services: {} as never,
        controller: {
          editor: {
            graph: {
              title: "  Whitespace Board  ",
            },
          },
        } as never,
      });

      await shellActions.updatePageTitle();

      // Title should not have leading/trailing whitespace before separator
      assert.ok(
        capturedTitle.startsWith("Whitespace Board - "),
        `Expected title to start with trimmed name, got: ${capturedTitle}`
      );
    });
  });
});
