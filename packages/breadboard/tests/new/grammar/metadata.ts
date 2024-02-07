/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { board } from "../../../src/new/grammar/board.js";

import { testKit } from "../../helpers/_test-kit.js";

test("metadata in board constructor", async (t) => {
  const graph = board(
    {
      input: {
        type: "object",
        required: ["foo"],
        properties: {
          foo: {
            type: "string",
          },
        },
      },
      output: {
        type: "object",
        required: ["foo"],
        properties: {
          foo: {
            type: "string",
          },
        },
      },
      url: "data:",
      title: "test",
      description: "test test",
      version: "0.0.1",
    },
    (inputs) => testKit.noop(inputs)
  );

  const serialized = await graph.serialize();

  t.like(serialized, {
    url: "data:",
    title: "test",
    description: "test test",
    version: "0.0.1",
  });
});

test("metadata in serialize", async (t) => {
  const graph = board((inputs) => testKit.noop(inputs));

  const serialized = await graph.serialize({
    url: "data:",
    title: "test",
    description: "test test",
    version: "0.0.1",
  });

  t.like(serialized, {
    url: "data:",
    title: "test",
    description: "test test",
    version: "0.0.1",
  });
});

test("metadata in serialize overrides metadata in constructor", async (t) => {
  const graph = board(
    {
      input: {
        type: "object",
        required: ["foo"],
        properties: {
          foo: {
            type: "string",
          },
        },
      },
      output: {
        type: "object",
        required: ["foo"],
        properties: {
          foo: {
            type: "string",
          },
        },
      },
      title: "constructor",
      description: "test test",
    },
    (inputs) => testKit.noop(inputs)
  );

  const serialized = await graph.serialize({
    url: "data:",
    title: "serialized",
  });

  t.like(serialized, {
    url: "data:",
    title: "serialized",
    description: "test test",
  });
});
