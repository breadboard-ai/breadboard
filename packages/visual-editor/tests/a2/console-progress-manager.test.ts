/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toTitleCase,
  trimEllipsis,
} from "../../src/a2/agent/console-progress-manager.js";

describe("toTitleCase", () => {
  it("capitalizes the first letter of a single word", () => {
    assert.equal(toTitleCase("hello"), "Hello");
  });

  it("capitalizes the first letter of each word", () => {
    assert.equal(toTitleCase("hello world"), "Hello World");
  });

  it("preserves already-capitalized words", () => {
    assert.equal(toTitleCase("Hello World"), "Hello World");
  });

  it("handles an empty string", () => {
    assert.equal(toTitleCase(""), "");
  });

  it("handles a single character", () => {
    assert.equal(toTitleCase("a"), "A");
  });

  it("does not capitalize after an apostrophe (possessive)", () => {
    assert.equal(toTitleCase("critique's depth"), "Critique's Depth");
  });

  it("does not capitalize after an apostrophe (contraction)", () => {
    assert.equal(toTitleCase("don't stop"), "Don't Stop");
  });

  it("does not capitalize inside parentheses", () => {
    assert.equal(toTitleCase("generating image(s)"), "Generating Image(s)");
  });

  it("handles multiple apostrophes", () => {
    assert.equal(toTitleCase("it's a dog's life"), "It's A Dog's Life");
  });

  it("handles hyphenated words without capitalizing after the hyphen", () => {
    assert.equal(toTitleCase("well-known fact"), "Well-known Fact");
  });

  it("handles multiple spaces between words", () => {
    assert.equal(toTitleCase("hello  world"), "Hello  World");
  });

  it("handles leading whitespace", () => {
    assert.equal(toTitleCase(" hello"), " Hello");
  });

  it("handles trailing whitespace", () => {
    assert.equal(toTitleCase("hello "), "Hello ");
  });

  it("handles tabs as word separators", () => {
    assert.equal(toTitleCase("hello\tworld"), "Hello\tWorld");
  });

  it("handles mixed case input", () => {
    assert.equal(toTitleCase("hELLO wORLD"), "HELLO WORLD");
  });

  it("leaves numbers untouched", () => {
    assert.equal(toTitleCase("test 123 value"), "Test 123 Value");
  });

  it("handles the original bug: analyzing critique's depth", () => {
    assert.equal(
      toTitleCase("analyzing critique's depth"),
      "Analyzing Critique's Depth"
    );
  });

  it("handles the original bug: generating image(s)", () => {
    assert.equal(toTitleCase("generating image(s)"), "Generating Image(s)");
  });
});

describe("trimEllipsis", () => {
  it("removes trailing ellipsis", () => {
    assert.equal(trimEllipsis("loading..."), "loading");
  });

  it("leaves strings without trailing ellipsis unchanged", () => {
    assert.equal(trimEllipsis("hello"), "hello");
  });

  it("only removes trailing ellipsis, not mid-string", () => {
    assert.equal(trimEllipsis("wait... for it"), "wait... for it");
  });

  it("handles an empty string", () => {
    assert.equal(trimEllipsis(""), "");
  });

  it("handles a string that is only ellipsis", () => {
    assert.equal(trimEllipsis("..."), "");
  });

  it("removes only the final ellipsis when there are multiple", () => {
    assert.equal(trimEllipsis("wait... loading..."), "wait... loading");
  });

  it("does not remove fewer than three dots", () => {
    assert.equal(trimEllipsis("hello.."), "hello..");
  });

  it("does not remove more than three dots as a single ellipsis", () => {
    assert.equal(trimEllipsis("hello...."), "hello.");
  });
});
