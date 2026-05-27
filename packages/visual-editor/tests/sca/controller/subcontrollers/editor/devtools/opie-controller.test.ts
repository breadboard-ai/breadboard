/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { suite, test } from "node:test";
import assert from "node:assert/strict";
import { OpieController } from "../../../../../../src/sca/controller/subcontrollers/editor/devtools/opie-controller.js";
import type { LLMContent } from "@breadboard-ai/types";

suite("OpieController", () => {
  suite("setSystemInstruction", () => {
    test("sets empty string initially", () => {
      const ctrl = new OpieController("opie_1", "OpieController");
      assert.strictEqual(ctrl.systemInstruction, "");
    });

    test("sets string instruction", () => {
      const ctrl = new OpieController("opie_2", "OpieController");
      ctrl.setSystemInstruction("Be helpful");
      assert.strictEqual(ctrl.systemInstruction, "Be helpful");
    });

    test("sets null/undefined instruction to empty string", () => {
      const ctrl = new OpieController("opie_3", "OpieController");
      ctrl.setSystemInstruction("Help");
      ctrl.setSystemInstruction(null);
      assert.strictEqual(ctrl.systemInstruction, "");
      ctrl.setSystemInstruction("Help");
      ctrl.setSystemInstruction(undefined);
      assert.strictEqual(ctrl.systemInstruction, "");
    });

    test("sets LLMContent instruction", () => {
      const ctrl = new OpieController("opie_4", "OpieController");
      const content: LLMContent = {
        parts: [{ text: "Instruction Part 1" }, { text: "Instruction Part 2" }],
      };
      ctrl.setSystemInstruction(content);
      assert.strictEqual(
        ctrl.systemInstruction,
        "Instruction Part 1\nInstruction Part 2"
      );
    });
  });

  suite("addObjective", () => {
    test("adds string objective", () => {
      const ctrl = new OpieController("opie_5", "OpieController");
      ctrl.addObjective("New Request");
      assert.strictEqual(ctrl.entries.length, 1);
      assert.strictEqual(ctrl.entries[0].kind, "objective");
      assert.deepStrictEqual(ctrl.entries[0].args, {
        user_request: "New Request",
      });
    });

    test("adds LLMContent objective", () => {
      const ctrl = new OpieController("opie_6", "OpieController");
      const content: LLMContent = {
        parts: [{ text: "Request Part A" }, { text: "Request Part B" }],
      };
      ctrl.addObjective(content);
      assert.strictEqual(ctrl.entries.length, 1);
      assert.strictEqual(ctrl.entries[0].kind, "objective");
      assert.deepStrictEqual(ctrl.entries[0].args, {
        user_request: "Request Part A\nRequest Part B",
      });
    });

    test("updates existing objective", () => {
      const ctrl = new OpieController("opie_7", "OpieController");
      ctrl.addObjective("Original Objective");
      ctrl.addObjective("Updated Objective");
      assert.strictEqual(ctrl.entries.length, 1);
      assert.strictEqual(ctrl.entries[0].kind, "objective");
      assert.deepStrictEqual(ctrl.entries[0].args, {
        user_request: "Updated Objective",
      });
    });
  });

  suite("updateCallResponse", () => {
    test("handles functionResponse in LLMContent", () => {
      const ctrl = new OpieController("opie_8", "OpieController");
      ctrl.addCall("call-1", "test_func", {});
      const response: LLMContent = {
        parts: [
          {
            functionResponse: {
              name: "test_func",
              response: { result: "Success" },
            },
          },
        ],
      };
      ctrl.updateCallResponse("call-1", response);
      assert.strictEqual(ctrl.entries.length, 1);
      assert.deepStrictEqual(ctrl.entries[0].response, { result: "Success" });
    });

    test("handles regular record object", () => {
      const ctrl = new OpieController("opie_9", "OpieController");
      ctrl.addCall("call-2", "test_func", {});
      const response = { status: "OK" };
      ctrl.updateCallResponse("call-2", response);
      assert.deepStrictEqual(ctrl.entries[0].response, { status: "OK" });
    });
  });

  suite("addCall & addThought", () => {
    test("adds call and thought entries to log", () => {
      const ctrl = new OpieController("opie_10", "OpieController");
      ctrl.addThought("I should check status");
      ctrl.addCall("c-1", "get_status", { id: 123 });
      assert.strictEqual(ctrl.entries.length, 2);
      assert.strictEqual(ctrl.entries[0].kind, "thought");
      assert.strictEqual(ctrl.entries[1].kind, "call");
    });
  });
});
