/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isBoardBehavior,
  isBoardArrayBehavior,
  isControllerBehavior,
  isPortSpecBehavior,
  isCodeBehavior,
  isSingleLineBehavior,
  isLLMContentBehavior,
  isConfigurableBehavior,
  isLLMContentArrayBehavior,
  isTextBehavior,
  isMainPortBehavior,
  isPreviewBehavior,
  behaviorsMatch,
} from "../../src/utils/schema/behaviors.js";

describe("behaviors", () => {
  describe("isBoardBehavior", () => {
    it("returns true when behavior includes 'board'", () => {
      assert.equal(isBoardBehavior({ behavior: ["board"] }), true);
    });

    it("returns true when behavior includes 'board' among others", () => {
      assert.equal(isBoardBehavior({ behavior: ["config", "board"] }), true);
    });

    it("returns false when behavior does not include 'board'", () => {
      assert.equal(isBoardBehavior({ behavior: ["config"] }), false);
    });

    it("returns false when behavior is undefined", () => {
      assert.equal(isBoardBehavior({}), false);
    });
  });

  describe("isBoardArrayBehavior", () => {
    it("returns true for array of boards", () => {
      assert.equal(
        isBoardArrayBehavior({
          type: "array",
          items: { behavior: ["board"] },
        }),
        true
      );
    });

    it("returns false for non-array type", () => {
      assert.equal(
        isBoardArrayBehavior({
          type: "string",
          items: { behavior: ["board"] },
        }),
        false
      );
    });

    it("returns false when items is missing", () => {
      assert.equal(isBoardArrayBehavior({ type: "array" }), false);
    });

    it("returns false when items is an array (tuple)", () => {
      assert.equal(
        isBoardArrayBehavior({
          type: "array",
          items: [{ behavior: ["board"] }],
        }),
        false
      );
    });

    it("returns false when items has no behavior", () => {
      assert.equal(isBoardArrayBehavior({ type: "array", items: {} }), false);
    });
  });

  describe("isControllerBehavior", () => {
    it("returns true when behavior includes 'hint-controller'", () => {
      assert.equal(
        isControllerBehavior({ behavior: ["hint-controller"] }),
        true
      );
    });

    it("returns false when behavior is empty", () => {
      assert.equal(isControllerBehavior({ behavior: [] }), false);
    });
  });

  describe("isPortSpecBehavior", () => {
    it("returns true for ports-spec", () => {
      assert.equal(isPortSpecBehavior({ behavior: ["ports-spec"] }), true);
    });
  });

  describe("isCodeBehavior", () => {
    it("returns true for hint-code", () => {
      assert.equal(isCodeBehavior({ behavior: ["hint-code"] }), true);
    });
  });

  describe("isSingleLineBehavior", () => {
    it("returns true for hint-single-line", () => {
      assert.equal(
        isSingleLineBehavior({ behavior: ["hint-single-line"] }),
        true
      );
    });
  });

  describe("isLLMContentBehavior", () => {
    it("returns true for llm-content", () => {
      assert.equal(isLLMContentBehavior({ behavior: ["llm-content"] }), true);
    });

    it("returns false for unrelated behavior", () => {
      assert.equal(isLLMContentBehavior({ behavior: ["config"] }), false);
    });
  });

  describe("isConfigurableBehavior", () => {
    it("returns true for config", () => {
      assert.equal(isConfigurableBehavior({ behavior: ["config"] }), true);
    });
  });

  describe("isLLMContentArrayBehavior", () => {
    it("returns true for array of llm-content objects", () => {
      assert.equal(
        isLLMContentArrayBehavior({
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
        }),
        true
      );
    });

    it("returns false when items type is not object", () => {
      assert.equal(
        isLLMContentArrayBehavior({
          type: "array",
          items: { type: "string", behavior: ["llm-content"] },
        }),
        false
      );
    });

    it("returns false when items is a tuple", () => {
      assert.equal(
        isLLMContentArrayBehavior({
          type: "array",
          items: [{ type: "object", behavior: ["llm-content"] }],
        }),
        false
      );
    });
  });

  describe("isTextBehavior", () => {
    it("returns true for string type", () => {
      assert.equal(isTextBehavior({ type: "string" }), true);
    });

    it("returns false for non-string type", () => {
      assert.equal(isTextBehavior({ type: "object" }), false);
    });
  });

  describe("isMainPortBehavior", () => {
    it("returns true for main-port", () => {
      assert.equal(isMainPortBehavior({ behavior: ["main-port"] }), true);
    });
  });

  describe("isPreviewBehavior", () => {
    it("returns true for hint-preview", () => {
      assert.equal(isPreviewBehavior({ behavior: ["hint-preview"] }), true);
    });
  });

  describe("behaviorsMatch", () => {
    it("returns true when behaviors are identical", () => {
      assert.equal(
        behaviorsMatch(
          { behavior: ["board", "config"] },
          { behavior: ["board", "config"] }
        ),
        true
      );
    });

    it("returns false when behaviors differ in length", () => {
      assert.equal(
        behaviorsMatch(
          { behavior: ["board"] },
          { behavior: ["board", "config"] }
        ),
        false
      );
    });

    it("returns false when behaviors differ in content", () => {
      assert.equal(
        behaviorsMatch({ behavior: ["board"] }, { behavior: ["config"] }),
        false
      );
    });

    it("returns true when both are undefined", () => {
      assert.equal(behaviorsMatch({}, {}), true);
    });
  });
});
