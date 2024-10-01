/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import promptTemplate from "../../bgl/prompt-template.bgl.json" with { type: "json" };
import { GraphDescriptor } from "@breadboard-ai/types";
import { inspectableGraph } from "../../../src/inspector/graph.js";
import { testKit } from "../test-kit.js";
import { createLoader } from "../../../src/index.js";
import { deepEqual } from "node:assert";

describe("InspectableGraph", async () => {
  test("uses describe entry point", async () => {
    const graph = promptTemplate as GraphDescriptor;
    const loader = createLoader();
    const inspectable = inspectableGraph(graph, {
      kits: [testKit],
      loader,
    });
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          template: {
            description:
              "The template string to substitute the parameters into",
            format: "multiline",
            title: "Template",
            type: "string",
          },
        },
        required: ["template"],
      },
      outputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            format: "multiline",
            title: "Prompt",
            description: "The prompt string with the parameters substituted",
          },
        },
      },
    };
    const result = await inspectable.describe();
    deepEqual(result, expected);
  });

  test("passes inputs to describe", async () => {
    const graph = promptTemplate as GraphDescriptor;
    const loader = createLoader();
    const inspectable = inspectableGraph(graph, {
      kits: [testKit],
      loader,
    });
    const expected = {
      inputSchema: {
        type: "object",
        properties: {
          template: {
            description:
              "The template string to substitute the parameters into",
            format: "multiline",
            title: "Template",
            type: "string",
          },
          "p-name": {
            description: 'The value to substitute for the parameter "name"',
            title: "name",
            type: "string",
          },
        },
        required: ["template", "p-name"],
      },
      outputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            format: "multiline",
            title: "Prompt",
            description: "The prompt string with the parameters substituted",
          },
        },
      },
    };
    const result = await inspectable.describe({ template: "Hello, {{name}}!" });
    deepEqual(result, expected);
  });
});
