/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transformConfiguration } from "../../../src/ui/transforms/transform-all-nodes.js";
import type { TemplatePart } from "@breadboard-ai/utils";
import type { NodeConfiguration } from "@breadboard-ai/types";

/**
 * Helper: builds an LLMContent configuration value containing the given
 * template text.
 */
function configWith(text: string): NodeConfiguration {
  return {
    prompt: { role: "user", parts: [{ text }] },
  };
}

/** Serializes a TemplatePart into the `{{...}}` format used in templates. */
function chip(part: TemplatePart): string {
  return `{${JSON.stringify(part)}}`;
}

const routeChip = (instance: string): TemplatePart => ({
  type: "tool",
  path: "control-flow/routing",
  title: "Target",
  instance,
});

const inChip = (path: string): TemplatePart => ({
  type: "in",
  path,
  title: `@${path}`,
});

describe("transformConfiguration — removal sentinel", () => {
  it("removes a template part when transformer returns false", () => {
    const text = `Route to: ${chip(routeChip("target-1"))}`;
    const config = configWith(text);

    const result = transformConfiguration("node-1", config, (part) => {
      if (part.instance === "target-1") return false;
      return null;
    });

    assert.ok(result, "should return updated config");
    const parts = (result!.prompt as { parts: { text: string }[] }).parts;
    assert.ok(!parts[0].text.includes("target-1"), "target-1 should be gone");
    assert.equal(parts[0].text, "Route to: ");
  });

  it("removes only the matching part and preserves others", () => {
    const text = `${chip(routeChip("keep-me"))} then ${chip(routeChip("remove-me"))} done`;
    const config = configWith(text);

    const result = transformConfiguration("node-1", config, (part) => {
      if (part.instance === "remove-me") return false;
      return null;
    });

    assert.ok(result, "should return updated config");
    const parts = (result!.prompt as { parts: { text: string }[] }).parts;
    assert.ok(
      parts[0].text.includes("keep-me"),
      "kept part should be preserved"
    );
    assert.ok(
      !parts[0].text.includes("remove-me"),
      "removed part should be gone"
    );
    assert.ok(parts[0].text.includes(" done"), "trailing text preserved");
  });

  it("returns null when transformer returns null for all parts", () => {
    const text = `${chip(routeChip("target-1"))}`;
    const config = configWith(text);

    const result = transformConfiguration("node-1", config, () => null);
    assert.equal(result, null, "no changes = null return");
  });

  it("handles multiple removals in one pass", () => {
    const text = `${chip(routeChip("a"))} ${chip(routeChip("b"))} ${chip(routeChip("c"))}`;
    const config = configWith(text);

    const result = transformConfiguration("node-1", config, (part) => {
      if (part.instance === "a" || part.instance === "c") return false;
      return null;
    });

    assert.ok(result, "should return updated config");
    const parts = (result!.prompt as { parts: { text: string }[] }).parts;
    assert.ok(!parts[0].text.includes('"a"'), "a should be removed");
    assert.ok(parts[0].text.includes('"b"'), "b should be preserved");
    assert.ok(!parts[0].text.includes('"c"'), "c should be removed");
  });

  it("can mix removal and transformation", () => {
    const text = `${chip(inChip("node-a"))} ${chip(routeChip("remove"))}`;
    const config = configWith(text);

    const result = transformConfiguration("node-1", config, (part) => {
      if (part.instance === "remove") return false;
      if (part.path === "node-a") return { ...part, invalid: true };
      return null;
    });

    assert.ok(result, "should return updated config");
    const parts = (result!.prompt as { parts: { text: string }[] }).parts;
    assert.ok(!parts[0].text.includes("remove"), "removed part should be gone");
    assert.ok(
      parts[0].text.includes('"invalid":true'),
      "transformed part should be marked invalid"
    );
  });
});
