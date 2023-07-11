/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { parseSpec } from "../src/node.js";

test("parseSpec: control-only", (t) => {
  t.deepEqual(parseSpec(""), {});
});

test("parseSpec: all-value", (t) => {
  t.deepEqual(parseSpec("*"), { out: "*" });
});

test("parseSpec: simple", (t) => {
  t.deepEqual(parseSpec("a"), { out: "a", in: "a" });
});

test("parseSpec: simple with optional", (t) => {
  t.deepEqual(parseSpec("a?"), { out: "a", in: "a", optional: true });
});

test("parseSpec: simple with constant", (t) => {
  t.deepEqual(parseSpec("a."), { out: "a", in: "a", constant: true });
});

test("parseSpec: simple with optional and constant", (t) => {
  t.deepEqual(parseSpec("a?."), {
    out: "a?",
    in: "a?",
    constant: true,
  });
});

test("parseSpec: simple with constant and optional", (t) => {
  t.deepEqual(parseSpec("a.?"), {
    out: "a.",
    in: "a.",
    optional: true,
  });
});

test("parseSpec: both in and out specified", (t) => {
  t.deepEqual(parseSpec("a->b"), { out: "a", in: "b" });
});

test("parseSpec: both in and out specified with optional", (t) => {
  t.deepEqual(parseSpec("a->b?"), { out: "a", in: "b", optional: true });
});

test("parseSpec: both in and out specified with constant", (t) => {
  t.deepEqual(parseSpec("a->b."), { out: "a", in: "b", constant: true });
});
