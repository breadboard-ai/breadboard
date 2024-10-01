/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { GraphDescriptor } from "@breadboard-ai/types";
import { inspectableGraph } from "../../src/inspector/graph.js";
import { PortType } from "../../src/inspector/ports.js";
import { Schema } from "../../src/types.js";

test("collectPorts correctly reports edges", async (t) => {
  const graph = {
    nodes: [
      { id: "a", type: "input" },
      { id: "b", type: "bar" },
      { id: "c", type: "output" },
      { id: "d", type: "baz" },
    ],
    edges: [
      { from: "a", to: "b", in: "foo", out: "text" },
      { from: "d", to: "b", in: "foo", out: "baz" },
      { from: "b", to: "c", in: "text", out: "bar" },
    ],
  } satisfies GraphDescriptor;
  const inspectable = inspectableGraph(graph);
  const b = inspectable.nodeById("b");
  const ports = await b?.ports();
  const inputs = ports?.inputs?.ports;
  const outputs = ports?.outputs?.ports;
  t.deepEqual(
    inputs?.flatMap((p) =>
      p.edges?.map((e) => {
        return {
          in: e.in,
          out: e.out,
          from: e.from.descriptor.id,
          to: e.to.descriptor.id,
        };
      })
    ),
    [
      { in: "foo", out: "text", from: "a", to: "b" },
      { in: "foo", out: "baz", from: "d", to: "b" },
    ]
  );
  t.deepEqual(
    outputs?.flatMap((p) =>
      p.edges?.map((e) => {
        return {
          in: e.in,
          out: e.out,
          from: e.from.descriptor.id,
          to: e.to.descriptor.id,
        };
      })
    ),
    [{ in: "text", out: "bar", from: "b", to: "c" }]
  );
});

test("collectPorts correctly recognizes dangling ports", async (t) => {
  const graph = {
    nodes: [{ id: "a", type: "input" }],
    edges: [{ from: "a", to: "a", in: "foo", out: "text" }],
  } satisfies GraphDescriptor;
  const inspectable = inspectableGraph(graph);
  const a = inspectable.nodeById("a");
  const ports = await a?.ports();
  t.assert(ports?.inputs?.fixed);
  const inputs = ports?.inputs?.ports;
  t.deepEqual(
    inputs?.map((p) => ({ name: p.name, status: p.status })),
    [
      { name: "", status: "ready" },
      { name: "*", status: "ready" },
      { name: "foo", status: "dangling" },
      { name: "schema", status: "ready" },
    ]
  );
});

test("collectPorts adds an $error port", async (t) => {
  const graph = {
    nodes: [{ id: "a", type: "bar" }],
    edges: [],
  } satisfies GraphDescriptor;
  const inspectable = inspectableGraph(graph);
  const a = inspectable.nodeById("a");
  const ports = await a?.ports();
  const outputs = ports?.outputs?.ports;
  t.deepEqual(
    outputs?.map((p) => ({ name: p.name, status: p.status })),
    [
      { name: "", status: "ready" },
      { name: "$error", status: "ready" },
      { name: "*", status: "ready" },
    ]
  );
});

test("PortType correctly recognizes unknown types", (t) => {
  const from = new PortType({});
  const notTo = new PortType({ type: "object" });
  const to = new PortType({});
  const specificFrom = new PortType({ type: "number" });
  t.true(from.canConnect(to));
  t.false(from.canConnect(notTo));
  t.true(specificFrom.canConnect(to));
});

test("PortType matches strings, numbers, and booleans", (t) => {
  {
    const from = new PortType({ type: "string" });
    const to = new PortType({ type: "string" });
    const notTo = new PortType({ type: "number" });
    t.true(from.canConnect(to));
    t.false(from.canConnect(notTo));
  }
  {
    const from = new PortType({ type: "number" });
    const to = new PortType({ type: "number" });
    const notTo = new PortType({ type: "string" });
    t.true(from.canConnect(to));
    t.false(from.canConnect(notTo));
  }
});

test("PortType matches behaviors", (t) => {
  const from = new PortType({ type: "object", behavior: ["llm-content"] });
  const to = new PortType({ type: "object", behavior: ["llm-content"] });
  const alsoTo = new PortType({
    type: "object",
    behavior: ["llm-content", "deprecated"],
  });
  t.true(from.canConnect(to));
  t.true(from.canConnect(alsoTo));
});

test("PortType matches formats", (t) => {
  const audioOnly = new PortType({
    type: "object",
    behavior: ["llm-content"],
    format: "audio-file",
  } satisfies Schema);
  const any = new PortType({ type: "object", behavior: ["llm-content"] });
  const imageOnly = new PortType({
    type: "object",
    behavior: ["llm-content"],
    format: "image-file",
  } satisfies Schema);
  const audioAndImage = new PortType({
    type: "object",
    behavior: ["llm-content"],
    format: "audio-file,image-file",
  } satisfies Schema);
  t.true(audioOnly.canConnect(audioOnly));
  t.false(audioOnly.canConnect(imageOnly));
  t.false(audioAndImage.canConnect(imageOnly));
  // TODO(aomarks) Disabled because this is not compatible with
  // analyzeIsJsonSubSchema, which treats each format as distinct and doesn't
  // support the comma-delimited format. I think we should just be using `anyOf`
  // here if we want to make a union of multiple formats. See also
  // https://json-schema.org/understanding-json-schema/reference/non_json_data
  // which is how JSON Schema itself represents non-JSON data which we should
  // consider migrating to.
  // t.true(imageOnly.canConnect(audioAndImage));
  t.true(audioOnly.canConnect(any));
  t.false(any.canConnect(audioOnly));
});

test("PortType handles arrays", (t) => {
  const audioOnly = new PortType({
    type: "array",
    items: {
      type: "object",
      behavior: ["llm-content"],
      format: "audio-file",
    },
  } satisfies Schema);
  const any = new PortType({
    type: "array",
    items: { type: "object", behavior: ["llm-content"] },
  } satisfies Schema);

  t.true(audioOnly.canConnect(any));
  t.false(any.canConnect(audioOnly));

  const numbers = new PortType({
    type: "array",
    items: { type: "number" },
  });
  t.false(numbers.canConnect(any));
  t.false(audioOnly.canConnect(numbers));
  t.true(numbers.canConnect(numbers));
});
