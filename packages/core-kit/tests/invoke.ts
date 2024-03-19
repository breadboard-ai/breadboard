/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { relativeBaseURL } from "../src/nodes/invoke.js";
import { BoardRunner } from "@google-labs/breadboard";

test("relativeBasePath is relative to invoking board", (t) => {
  t.is(
    relativeBaseURL({
      board: { url: "http://bar" } as unknown as BoardRunner,
    }).href,
    "http://bar/"
  );
  t.is(
    relativeBaseURL({
      board: {} as unknown as BoardRunner,
      base: new URL("http://baz"),
    }).href,
    "http://baz/"
  );
});

test("relativeBasePath falls back to explicit option", (t) => {
  t.deepEqual(
    relativeBaseURL({
      board: { url: "file:///bar/foo" } as unknown as BoardRunner,
      base: new URL("http://baz"),
    }).href,
    "file:///bar/foo"
  );
});

test("relativeBasePath falls back to import URL", (t) => {
  t.regex(relativeBaseURL({}).href, /^file:\/\/\/.*\/invoke\..s$/);
});
