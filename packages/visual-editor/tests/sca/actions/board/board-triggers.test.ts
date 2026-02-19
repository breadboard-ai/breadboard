/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert";
import {
  onVersionChange,
  onNewerVersionAvailable,
  onSaveStatusChange,
  onSaveShortcut,
} from "../../../../src/sca/actions/board/triggers.js";

suite("Board Triggers", () => {
  suite("onVersionChange", () => {
    test("returns false when graph is readOnly", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 5,
              readOnly: true,
              editor: {},
            },
          },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when readOnly");
    });

    test("returns false when version is -1", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: -1,
              readOnly: false,
              editor: {},
            },
          },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when version is -1"
      );
    });

    test("returns false when editor is not available", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 5,
              readOnly: false,
              editor: null,
            },
          },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, false, "Should return false when no editor");
    });

    test("returns truthy value (version + 1) when all conditions are met", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 42,
              readOnly: false,
              editor: {},
            },
          },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);
      const result = trigger.condition();

      // Returns version + 1 so each increment is a unique change
      assert.strictEqual(
        result,
        43,
        "Should return version + 1 when conditions met"
      );
    });

    test("returns false when version is 0 (initial load bump)", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 0,
              readOnly: false,
              editor: {},
            },
          },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should not save on version 0 (load-induced bump)"
      );
    });

    test("returns truthy value (2) for version 1 (first real edit)", () => {
      const mockBind = {
        controller: {
          editor: {
            graph: {
              version: 1,
              readOnly: false,
              editor: {},
            },
          },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(result, 2, "Should save on first real edit");
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: {
          editor: { graph: { version: 1, readOnly: false, editor: {} } },
        },
        services: {},
      };

      const trigger = onVersionChange(mockBind as never);

      assert.strictEqual(trigger.name, "Board Version Change");
    });
  });

  suite("onNewerVersionAvailable", () => {
    test("returns true when newerVersionAvailable is truthy", () => {
      const mockBind = {
        controller: {
          board: {
            main: {
              newerVersionAvailable: { version: 10, url: "drive:/new" },
            },
          },
        },
        services: {},
      };

      const trigger = onNewerVersionAvailable(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        true,
        "Should return true when newer version exists"
      );
    });

    test("returns false when no newer version", () => {
      const mockBind = {
        controller: {
          board: {
            main: {
              newerVersionAvailable: null,
            },
          },
        },
        services: {},
      };

      const trigger = onNewerVersionAvailable(mockBind as never);
      const result = trigger.condition();

      assert.strictEqual(
        result,
        false,
        "Should return false when no newer version"
      );
    });

    test("has correct trigger name", () => {
      const mockBind = {
        controller: { board: { main: { newerVersionAvailable: null } } },
        services: {},
      };

      const trigger = onNewerVersionAvailable(mockBind as never);

      assert.strictEqual(trigger.name, "Newer Version Available");
    });
  });

  suite("onSaveStatusChange", () => {
    test("creates event trigger with correct configuration", () => {
      const mockEventTarget = {
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const mockBind = {
        controller: {},
        services: {
          googleDriveBoardServer: mockEventTarget,
        },
      };

      const trigger = onSaveStatusChange(mockBind as never);

      assert.strictEqual(trigger.name, "Save Status Change");
      assert.strictEqual(trigger.type, "event", "Should be an event trigger");
      assert.strictEqual(trigger.eventType, "savestatuschange");
      assert.strictEqual(trigger.target, mockEventTarget);
    });
  });

  suite("onSaveShortcut", () => {
    test("creates keyboard trigger with correct name and keys", () => {
      const mockBind = {
        controller: {
          editor: { graph: { editor: {} } },
        },
        services: {},
      };

      const trigger = onSaveShortcut(mockBind as never);

      assert.strictEqual(trigger.name, "Save Shortcut");
      assert.deepStrictEqual(trigger.keys, ["Cmd+s", "Ctrl+s"]);
    });

    test("guard returns true when editor is available", () => {
      const mockBind = {
        controller: {
          editor: { graph: { editor: {} } },
        },
        services: {},
      };

      const trigger = onSaveShortcut(mockBind as never);

      assert.strictEqual(trigger.guard!(undefined as never), true);
    });

    test("guard returns false when no editor", () => {
      const mockBind = {
        controller: {
          editor: { graph: { editor: null } },
        },
        services: {},
      };

      const trigger = onSaveShortcut(mockBind as never);

      assert.strictEqual(trigger.guard!(undefined as never), false);
    });
  });
});
