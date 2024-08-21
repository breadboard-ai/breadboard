/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  parametersFromTemplate,
  schemaFromParameters,
} from "../src/nodes/template-parser.js";

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

test("schemaFromParameters returns an valid schema when there are no parameters", (t) => {
  t.deepEqual(schemaFromParameters([]), {
    type: "object",
    properties: {},
    required: [],
  });
});

test("schemaFromParameters returns an valid schema", (t) => {
  t.deepEqual(schemaFromParameters(["foo"]), {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
    },
    required: ["foo"],
  });
});
