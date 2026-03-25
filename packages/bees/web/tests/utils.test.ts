/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getRelativeTime, extractPrompt, parseTags } from "../src/utils.js";

describe("parseTags", () => {
  it("splits comma-separated tags and trims whitespace", () => {
    assert.deepEqual(parseTags("foo, bar , baz"), ["foo", "bar", "baz"]);
  });

  it("filters out empty strings", () => {
    assert.deepEqual(parseTags(",, a,, b,,"), ["a", "b"]);
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(parseTags(""), []);
  });

  it("handles single tag without comma", () => {
    assert.deepEqual(parseTags("solo"), ["solo"]);
  });
});

describe("getRelativeTime", () => {
  it("returns empty string for undefined input", () => {
    assert.equal(getRelativeTime(undefined), "");
  });

  it("returns empty string for empty string input", () => {
    assert.equal(getRelativeTime(""), "");
  });

  it('returns "just now" for current time', () => {
    const now = new Date().toISOString();
    assert.equal(getRelativeTime(now), "just now");
  });

  it("returns seconds ago for recent times", () => {
    const past = new Date(Date.now() - 30_000).toISOString();
    const result = getRelativeTime(past);
    assert.match(result, /\d+ seconds? ago/);
  });

  it("returns minutes ago", () => {
    const past = new Date(Date.now() - 5 * 60_000).toISOString();
    const result = getRelativeTime(past);
    assert.match(result, /5 minutes ago/);
  });

  it("returns hours ago", () => {
    const past = new Date(Date.now() - 3 * 3600_000).toISOString();
    const result = getRelativeTime(past);
    assert.match(result, /3 hours ago/);
  });

  it("returns days ago", () => {
    const past = new Date(Date.now() - 2 * 86400_000).toISOString();
    const result = getRelativeTime(past);
    assert.match(result, /2 days ago/);
  });

  it("pluralises correctly for singular values", () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    assert.match(getRelativeTime(past), /1 day ago/);
  });
});

describe("extractPrompt", () => {
  it('returns "(no prompt)" when no suspend_event', () => {
    const ticket = { id: "1", objective: "test", status: "available" };
    assert.equal(extractPrompt(ticket), "(no prompt)");
  });

  it("extracts text from waitForInput", () => {
    const ticket = {
      id: "1",
      objective: "test",
      status: "suspended",
      suspend_event: {
        waitForInput: {
          prompt: {
            parts: [{ text: "What is your name?" }],
          },
        },
      },
    };
    assert.equal(extractPrompt(ticket), "What is your name?");
  });

  it("joins multiple text parts", () => {
    const ticket = {
      id: "1",
      objective: "test",
      status: "suspended",
      suspend_event: {
        waitForInput: {
          prompt: {
            parts: [{ text: "Line 1" }, { text: "Line 2" }],
          },
        },
      },
    };
    assert.equal(extractPrompt(ticket), "Line 1\nLine 2");
  });

  it("extracts from waitForChoice", () => {
    const ticket = {
      id: "1",
      objective: "test",
      status: "suspended",
      suspend_event: {
        waitForChoice: {
          prompt: {
            parts: [{ text: "Pick one" }],
          },
        },
      },
    };
    assert.equal(extractPrompt(ticket), "Pick one");
  });

  it('returns "(no prompt)" for empty parts', () => {
    const ticket = {
      id: "1",
      objective: "test",
      status: "suspended",
      suspend_event: {
        waitForInput: {
          prompt: { parts: [] },
        },
      },
    };
    assert.equal(extractPrompt(ticket), "(no prompt)");
  });
});
