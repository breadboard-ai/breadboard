/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Schema, BehaviorSchema } from "@breadboard-ai/types";
import {
  resolveArrayType,
  resolveBehaviorType,
  validate,
  isLLMContent,
  assertIsLLMContent,
  assertIsLLMContentArray,
} from "../../src/utils/schema/schema.js";

describe("schema", () => {
  describe("resolveArrayType", () => {
    it("returns 'string' for schema without items", () => {
      assert.equal(resolveArrayType({}), "string");
    });

    it("returns items type when present", () => {
      const schema: Schema = {
        items: { type: "number", behavior: [] as BehaviorSchema[] },
      };
      assert.equal(resolveArrayType(schema), "number");
    });

    it("defaults to 'string' when items has no type", () => {
      const schema: Schema = {
        items: { behavior: [] as BehaviorSchema[] },
      };
      assert.equal(resolveArrayType(schema), "string");
    });
  });

  describe("resolveBehaviorType", () => {
    it("returns null for undefined", () => {
      assert.equal(resolveBehaviorType(undefined), null);
    });

    it("returns null for array input", () => {
      assert.equal(resolveBehaviorType([{}, {}]), null);
    });

    it("returns first behavior from array", () => {
      assert.equal(
        resolveBehaviorType({ behavior: ["llm-content", "config"] }),
        "llm-content"
      );
    });

    it("returns null when no behavior", () => {
      assert.equal(resolveBehaviorType({}), null);
    });
  });

  describe("validate", () => {
    it("validates a simple schema", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      const result = validate({ name: "Alice" }, schema);
      assert.equal(result.valid, true);
    });

    it("returns errors for invalid input", () => {
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      };
      const result = validate({}, schema);
      assert.equal(result.valid, false);
      assert.ok(result.errors);
    });

    it("handles invalid schema gracefully", () => {
      const result = validate({}, { type: "invalid-type" });
      assert.equal(result.valid, false);
    });
  });

  describe("isLLMContent", () => {
    it("returns true for valid LLM content", () => {
      assert.equal(isLLMContent({ parts: [{ text: "hello" }] }), true);
    });

    it("returns true for LLM content with role", () => {
      assert.equal(
        isLLMContent({ role: "user", parts: [{ text: "hello" }] }),
        true
      );
    });

    it("returns false for non-object", () => {
      assert.equal(isLLMContent("string"), false);
    });

    it("returns false for null", () => {
      assert.equal(isLLMContent(null), false);
    });

    it("returns false for object without parts", () => {
      assert.equal(isLLMContent({ text: "not llm" }), false);
    });
  });

  describe("assertIsLLMContent", () => {
    it("does not throw for valid content", () => {
      assert.doesNotThrow(() => {
        assertIsLLMContent({ parts: [{ text: "hello" }] });
      });
    });

    it("throws for non-object", () => {
      assert.throws(() => assertIsLLMContent("string"), {
        message: "Not an object",
      });
    });

    it("throws for invalid content", () => {
      assert.throws(() => assertIsLLMContent({ noparts: true }));
    });
  });

  describe("assertIsLLMContentArray", () => {
    it("does not throw for valid array", () => {
      assert.doesNotThrow(() => {
        assertIsLLMContentArray([
          { parts: [{ text: "a" }] },
          { parts: [{ text: "b" }] },
        ]);
      });
    });

    it("throws for non-array", () => {
      assert.throws(() => assertIsLLMContentArray("string"), {
        message: "Not an array",
      });
    });

    it("throws for array of non-LLM-content", () => {
      assert.throws(() => assertIsLLMContentArray([{ bad: true }]), {
        message: "Not an LLM Content Array",
      });
    });
  });
});
