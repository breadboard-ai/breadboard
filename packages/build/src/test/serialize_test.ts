/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from "node:test";
import { defineNodeType, anyOf } from "@breadboard-ai/build";
import {
  board,
  type BoardDefinition,
  type BoardInputPorts,
  type BoardOutputPorts,
} from "../internal/board.js";
import { serialize } from "../internal/serialize.js";
import assert from "node:assert/strict";
import type { GraphDescriptor } from "@google-labs/breadboard";

const reverseString = defineNodeType({
  name: "reverseString",
  inputs: {
    forwards: {
      type: "string",
      description: "The string to reverse",
    },
  },
  outputs: {
    backwards: {
      type: "string",
      description: "The reversed string",
      primary: true,
    },
  },
  invoke: ({ forwards }) => {
    return {
      backwards: forwards.split("").reverse().join(""),
    };
  },
});

const templater = defineNodeType({
  name: "templater",
  inputs: {
    template: {
      type: "string",
      description: "A template with {{placeholders}}.",
    },
    "*": {
      type: anyOf("string", "number"),
      description: "Values to fill into template's {{placeholders}}.",
    },
  },
  outputs: {
    result: {
      type: "string",
      description: "The template with {{placeholders}} substituted.",
      primary: true,
    },
  },
  describe: ({ template }) => {
    return {
      inputs: Object.fromEntries(
        extractPlaceholders(template ?? "").map((name) => [
          name,
          {
            type: anyOf("string", "number"),
            description: `A value for the ${name} placeholder`,
          },
        ])
      ),
    };
  },
  invoke: ({ template }, placeholders) => {
    return {
      result: substituteTemplatePlaceholders(template, placeholders),
    };
  },
});

function extractPlaceholders(template: string): string[] {
  const matches = template.matchAll(/{{(?<name>[\w-]+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  const unique = Array.from(new Set(parameters));
  return unique;
}

function substituteTemplatePlaceholders(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, String(value)),
    template
  );
}

test("serialize", () => {
  const backwards = reverseString({ forwards: "potato" });
  const prompt = templater({
    template: "The word {{forwards}} is {{backwards}} in reverse.",
    forwards: "potato",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backwards: backwards.outputs.backwards as any,
  });
  const myBoard = board({}, { result: prompt.outputs.result });
  assert.deepEqual(
    serialize(
      // TODO(aomarks) Should not need this cast
      myBoard as object as BoardDefinition<BoardInputPorts, BoardOutputPorts>
    ),
    {
      nodes: [
        {
          id: "input-0",
          type: "input",
          configuration: {
            // TODO(aomarks) Schema
          },
        },
        {
          id: "output-0",
          type: "output",
          configuration: {
            // TODO(aomarks) Schema
          },
        },
        {
          id: "templater-0",
          type: "templater",
          configuration: {
            template: "The word {{forwards}} is {{backwards}} in reverse.",
            forwards: "potato",
          },
        },
        {
          id: "reverseString-0",
          type: "reverseString",
          configuration: {
            forwards: "potato",
          },
        },
      ],
      edges: [
        {
          from: "reverseString-0",
          out: "backwards",
          to: "templater-0",
          in: "backwards",
        },
        {
          from: "templater-0",
          out: "result",
          to: "output-0",
          in: "result",
        },
      ],
    } satisfies GraphDescriptor
  );
});
