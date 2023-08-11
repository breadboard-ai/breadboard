/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { parametersFromTemplate } from "../../src/nodes/prompt-template.js";

test("parametersFromTemplate returns an empty array when there are no parameters", (t) => {
  t.deepEqual(parametersFromTemplate("foo"), []);
});

test("parametersFromTemplate returns an array of parameters", (t) => {
  t.deepEqual(parametersFromTemplate("{{foo}}"), ["foo"]);
  t.deepEqual(parametersFromTemplate("{{foo}} {{bar}}"), ["foo", "bar"]);
  t.deepEqual(parametersFromTemplate("{{foo}} {{bar}} {{baz}}"), [
    "foo",
    "bar",
    "baz",
  ]);
});

test("parametersFromTemplate returns an array of unique parameters", (t) => {
  t.deepEqual(parametersFromTemplate("{{foo}} {{foo}}"), ["foo"]);
  t.deepEqual(parametersFromTemplate("{{foo}} {{bar}} {{foo}}"), [
    "foo",
    "bar",
  ]);
  t.deepEqual(parametersFromTemplate("{{foo}} {{bar}} {{baz}} {{foo}}"), [
    "foo",
    "bar",
    "baz",
  ]);
});

test("parametersFromTemplate recognizes dashes and underscores", (t) => {
  t.deepEqual(parametersFromTemplate("{{foo-bar}}"), ["foo-bar"]);
  t.deepEqual(parametersFromTemplate("{{foo_bar}}"), ["foo_bar"]);
  t.deepEqual(parametersFromTemplate("{{foo-bar}} {{foo_bar}}"), [
    "foo-bar",
    "foo_bar",
  ]);
  t.deepEqual(parametersFromTemplate("{{foo-bar}} {{foo_bar}} {{baz}}"), [
    "foo-bar",
    "foo_bar",
    "baz",
  ]);
});

test("parametersFromTemplate ignores empty parameters", (t) => {
  t.deepEqual(parametersFromTemplate("{{}}"), []);
  t.deepEqual(parametersFromTemplate("{{foo}} {{}}"), ["foo"]);
  t.deepEqual(parametersFromTemplate("{{foo}} {{}} {{baz}}"), ["foo", "baz"]);
});
