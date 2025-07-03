/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SENTINEL_BASE_URL, baseURLFromContext } from "@breadboard-ai/loader";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { deepStrictEqual } from "node:assert";
import { describe } from "node:test";

describe("relativeBasePath is relative to invoking board", () => {
  deepStrictEqual(
    baseURLFromContext({
      board: { url: "http://bar" } as GraphDescriptor,
    }).href,
    "http://bar/"
  );
  deepStrictEqual(
    baseURLFromContext({
      board: {} as GraphDescriptor,
      base: new URL("http://baz"),
    }).href,
    "http://baz/"
  );
});

describe("relativeBasePath falls back to explicit option", () => {
  deepStrictEqual(
    baseURLFromContext({
      board: { url: "file:///bar/foo" } as GraphDescriptor,
      base: new URL("http://baz"),
    }).href,
    "file:///bar/foo"
  );
});

describe("relativeBasePath falls back to SENTINEL_BASE_URL", () => {
  deepStrictEqual(baseURLFromContext({}).href, SENTINEL_BASE_URL.href);
});
