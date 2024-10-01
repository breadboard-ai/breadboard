/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  SENTINEL_BASE_URL,
  baseURLFromContext,
} from "../../src/loader/loader.js";
import { GraphDescriptor } from "@breadboard-ai/types";

test("relativeBasePath is relative to invoking board", (t) => {
  t.is(
    baseURLFromContext({
      board: { url: "http://bar" } as GraphDescriptor,
    }).href,
    "http://bar/"
  );
  t.is(
    baseURLFromContext({
      board: {} as GraphDescriptor,
      base: new URL("http://baz"),
    }).href,
    "http://baz/"
  );
});

test("relativeBasePath falls back to explicit option", (t) => {
  t.deepEqual(
    baseURLFromContext({
      board: { url: "file:///bar/foo" } as GraphDescriptor,
      base: new URL("http://baz"),
    }).href,
    "file:///bar/foo"
  );
});

test("relativeBasePath falls back to SENTINEL_BASE_URL", (t) => {
  t.is(baseURLFromContext({}).href, SENTINEL_BASE_URL.href);
});
