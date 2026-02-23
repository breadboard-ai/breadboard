/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanConfiguration } from "../../src/utils/scan-configuration.js";
import type { TemplatePart } from "@breadboard-ai/utils/template.js";

/**
 * Helper to create a template placeholder string in the JSON-based format
 * used by the Template class: {{"type":"in","path":"<name>","title":"<title>"}}
 */
function tp(path: string, title = path): string {
  return `{${JSON.stringify({ type: "in", path, title })}}`;
}

describe("scanConfiguration", () => {
  it("finds template placeholders in LLM content text parts", () => {
    const config = {
      prompt: {
        role: "user",
        parts: [{ text: `Hello ${tp("name")}, welcome to ${tp("place")}!` }],
      },
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 2);
    assert.equal(found[0].path, "name");
    assert.equal(found[1].path, "place");
  });

  it("finds placeholders in LLM content arrays", () => {
    const config = {
      context: [
        {
          role: "user",
          parts: [{ text: `Query: ${tp("query")}` }],
        },
        {
          role: "model",
          parts: [{ text: `Response: ${tp("response")}` }],
        },
      ],
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 2);
    assert.equal(found[0].path, "query");
    assert.equal(found[1].path, "response");
  });

  it("skips ports with no LLM content", () => {
    const config = {
      temperature: 0.7,
      maxTokens: 100,
      text: "plain string",
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 0);
  });

  it("skips text parts without template placeholders", () => {
    const config = {
      prompt: {
        role: "user",
        parts: [{ text: "Hello world, no placeholders here." }],
      },
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 0);
  });

  it("skips non-text parts (e.g. inlineData)", () => {
    const config = {
      prompt: {
        role: "user",
        parts: [{ inlineData: { mimeType: "image/png", data: "abc" } }],
      },
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 0);
  });

  it("handles empty configuration", () => {
    const found: TemplatePart[] = [];
    scanConfiguration({}, (part) => found.push({ ...part }));
    assert.equal(found.length, 0);
  });

  it("handles mixed port types — only scans LLM content ports", () => {
    const config = {
      temperature: 0.5,
      prompt: {
        role: "user",
        parts: [{ text: `Hello ${tp("name")}` }],
      },
      count: 42,
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 1);
    assert.equal(found[0].path, "name");
  });

  it("scans multiple text parts in a single LLM content", () => {
    const config = {
      prompt: {
        role: "user",
        parts: [
          { text: `First: ${tp("alpha")}` },
          { text: `Second: ${tp("beta")}` },
        ],
      },
    };

    const found: TemplatePart[] = [];
    scanConfiguration(config, (part) => found.push({ ...part }));
    assert.equal(found.length, 2);
    assert.equal(found[0].path, "alpha");
    assert.equal(found[1].path, "beta");
  });
});
