/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import promptTemplate, {
  parametersFromTemplate,
  stringify,
  substitute,
} from "../../src/nodes/prompt-template.js";

test("parametersFromTemplate returns an empty array when there are no parameters", (t) => {
  t.deepEqual(parametersFromTemplate("foo"), []);
});

test("parametersFromTemplate returns an empty array when there's no template", (t) => {
  t.deepEqual(parametersFromTemplate(undefined), []);
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

test("stringify correctly serializes objects", (t) => {
  t.is(stringify("foo"), "foo");
  t.is(stringify(42), "42");
  t.is(stringify(true), "true");
  t.is(stringify(false), "false");
  t.is(stringify(null), "null");
  t.is(stringify(undefined), "undefined");
  t.is(stringify({}), "{}");
  t.is(stringify({ foo: "bar" }), '{\n  "foo": "bar"\n}');
  t.is(stringify([1, 2, 3]), "[\n  1,\n  2,\n  3\n]");
});

test("substitute replaces parameters with stringified values", (t) => {
  t.is(substitute("{{foo}}", { foo: "bar" }), "bar");
  t.is(substitute("{{foo}} {{bar}}", { foo: "bar", bar: 42 }), "bar 42");
  t.is(
    substitute("{{foo}} {{bar}} {{baz}}", {
      foo: "bar",
      bar: 42,
      baz: true,
    }),
    "bar 42 true"
  );
  t.is(
    substitute("{{foo}} {{bar}} {{baz}}", { foo: "bar", baz: true }),
    "bar {{bar}} true"
  );
  t.is(
    substitute("{{foo}} {{bar}}", { foo: "bar", bar: { baz: 42 } }),
    'bar {\n  "baz": 42\n}'
  );
});

test("`generateInputSchema` correctly generates schema for a template with no parameters", async (t) => {
  const inputs = { template: "foo" };
  const result = (await promptTemplate.describe(inputs)).inputSchema;
  t.deepEqual(result, {
    type: "object",
    properties: {
      template: {
        title: "Template",
        description: "The template with placeholders to fill in.",
        type: "string",
        format: "multiline",
      },
    },
    required: ["template"],
    additionalProperties: false,
  });
});

test("`generateInputSchema` correctly generates schema for a template with parameters", async (t) => {
  const inputs = { template: "{{foo}} {{bar}}" };
  const result = (await promptTemplate.describe(inputs)).inputSchema;
  t.deepEqual(result, {
    type: "object",
    properties: {
      foo: {
        title: "foo",
        description: 'The value to substitute for the parameter "foo"',
        type: ["array", "boolean", "null", "number", "object", "string"],
      },
      bar: {
        title: "bar",
        description: 'The value to substitute for the parameter "bar"',
        type: ["array", "boolean", "null", "number", "object", "string"],
      },
      template: {
        title: "Template",
        description: "The template with placeholders to fill in.",
        type: "string",
        format: "multiline",
      },
    },
    required: ["bar", "foo", "template"],
    additionalProperties: false,
  });
});
