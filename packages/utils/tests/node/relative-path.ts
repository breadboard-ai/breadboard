/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import { describe, it } from "node:test";
import { relativePath } from "../../src/relative-path.js";

function yes(fromString: string, toString: string, relativeExpected?: string) {
  const from = new URL(fromString);
  const to = new URL(toString);
  const relative = relativePath(from, to);
  if (relativeExpected) {
    deepStrictEqual(relative, relativeExpected);
  }
  const absolute = new URL(relative, from);
  deepStrictEqual(absolute.href, to.href);
}

describe("Relative path", () => {
  it("handles different protocols", () => {
    yes("https://example.com", "http://example.com");
    yes("https://example.com", "blob:example.com");
  });

  it("handles different hosts", () => {
    yes("https://example.com", "https://example2.com");
  });

  it("handles same URL", () => {
    yes(
      "https://example.com/foo/index",
      "https://example.com/foo/index",
      "./index"
    );
  });

  it("navigates directory structures", () => {
    yes(
      "https://example.com/foo/bar/",
      "https://example.com/foo/index.html",
      "../index.html"
    );
    yes(
      "https://example.com/foo/bar/baz/blah.html",
      "https://example.com/foo/index.html",
      "../../index.html"
    );
    yes(
      "https://example.com/foo/bar/blah.html?quz#fuzz",
      "https://example.com/foo/index.html",
      "../index.html"
    );
    yes(
      "https://example.com/foo/blah.html?quz#fuzz",
      "https://example.com/foo/index.html",
      "./index.html"
    );
    yes(
      "https://example.com/blah.html?quz#fuzz",
      "https://example.com/foo/baz/index.html",
      "./foo/baz/index.html"
    );
    yes(
      "https://example.com/bar/blah.html?quz#fuzz",
      "https://example.com/foo/baz/index.html",
      "../foo/baz/index.html"
    );
    yes(
      "https://example.com/bar/blah.html?quz#fuzz",
      "https://example.com/foo/baz/",
      "../foo/baz/"
    );
  });

  it("correctly passes through search and hash", () => {
    yes(
      "https://example.com/bar/blah.html?quz#fuzz",
      "https://example.com/foo/baz.html?bar+test#blah",
      "../foo/baz.html?bar+test#blah"
    );
  });
});
