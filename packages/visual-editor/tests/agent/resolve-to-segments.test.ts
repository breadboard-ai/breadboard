/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { stubModuleArgs } from "../useful-stubs.js";
import { resolveToSegments } from "../../src/a2/agent/resolve-to-segments.js";
import type { Segment } from "../../src/a2/agent/resolve-to-segments.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

describe("resolveToSegments", () => {
  beforeEach(() => {
    setDOM();
  });

  afterEach(() => {
    unsetDOM();
  });

  it("resolves plain text objective to a text segment", async () => {
    const objective = {
      parts: [{ text: "Write a haiku about coding" }],
      role: "user" as const,
    };

    const result = await resolveToSegments(objective, {}, stubModuleArgs);
    if (!ok(result)) {
      assert.fail(result.$error);
    }

    // Should produce a text segment from the resolved template.
    const textSegments = result.segments.filter(
      (s: Segment) => s.type === "text"
    );
    assert.ok(textSegments.length > 0, "Should have at least one text segment");
    const fullText = textSegments
      .map((s: Segment) => (s.type === "text" ? s.text : ""))
      .join("");
    assert.ok(
      fullText.includes("Write a haiku about coding"),
      "Text should contain the original objective"
    );
  });

  it("resolves objective with no templates to text segments", async () => {
    const objective = {
      parts: [{ text: "Hello " }, { text: "world" }],
      role: "user" as const,
    };

    const result = await resolveToSegments(objective, {}, stubModuleArgs);
    if (!ok(result)) {
      assert.fail(result.$error);
    }

    const textSegments = result.segments.filter(
      (s: Segment) => s.type === "text"
    );
    assert.ok(textSegments.length >= 1, "Should have text segments");
  });

  it("sets useNotebookLM to false by default", async () => {
    const objective = {
      parts: [{ text: "plain text" }],
      role: "user" as const,
    };

    const result = await resolveToSegments(objective, {}, stubModuleArgs);
    if (!ok(result)) {
      assert.fail(result.$error);
    }

    assert.strictEqual(result.flags.useNotebookLM, false);
  });

  it("returns segments and flags structure", async () => {
    const objective = {
      parts: [{ text: "test" }],
      role: "user" as const,
    };

    const result = await resolveToSegments(objective, {}, stubModuleArgs);
    if (!ok(result)) {
      assert.fail(result.$error);
    }

    assert.ok(Array.isArray(result.segments), "segments should be an array");
    assert.ok(typeof result.flags === "object", "flags should be an object");
    assert.ok(
      "useNotebookLM" in result.flags,
      "flags should have useNotebookLM"
    );
  });

  it("wraps non-text data parts as input segments", async () => {
    const objective = {
      parts: [
        { text: "Analyze this: " },
        { inlineData: { data: "base64img", mimeType: "image/png" } },
      ],
      role: "user" as const,
    };

    const result = await resolveToSegments(objective, {}, stubModuleArgs);
    if (!ok(result)) {
      assert.fail(result.$error);
    }

    // The inlineData part should become an input segment with title "attachment".
    const inputSegments = result.segments.filter(
      (s: Segment) => s.type === "input"
    );
    assert.ok(
      inputSegments.length > 0,
      "Should have at least one input segment for the data part"
    );
    const attachment = inputSegments.find(
      (s: Segment) => s.type === "input" && s.title === "attachment"
    );
    assert.ok(attachment, "Non-text parts should become 'attachment' inputs");
  });

  it("handles empty objective", async () => {
    const objective = {
      parts: [{ text: "" }],
      role: "user" as const,
    };

    const result = await resolveToSegments(objective, {}, stubModuleArgs);
    if (!ok(result)) {
      assert.fail(result.$error);
    }

    // Empty text parts should be skipped
    assert.ok(Array.isArray(result.segments));
  });
});
