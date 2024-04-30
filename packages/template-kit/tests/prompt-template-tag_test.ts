/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { board, input, serialize } from "@breadboard-ai/build";
import { prompt, promptPlaceholder } from "@google-labs/template-kit";
import test from "ava";

test("usage", (t) => {
  const dish = input();
  const steps = input({ default: 10 });

  prompt`No placeholders`;
  prompt`Write a ${dish} recipe in under ${steps} steps`;
  prompt`Invalid placeholder: ${
    // @ts-expect-error
    undefined
  }`;

  t.pass();
});

test("serialization with automatic ID", (t) => {
  const dish = input();
  const steps = input({ default: 10 });
  const instructions = prompt`Write a ${dish} recipe in under ${steps} steps`;
  const bgl = serialize(
    board({
      inputs: { dish, steps },
      outputs: { instructions },
    })
  );
  t.deepEqual(bgl, {
    edges: [
      {
        from: "input-0",
        to: "promptTemplate-0",
        in: "p0",
        out: "dish",
      },
      {
        from: "input-0",
        to: "promptTemplate-0",
        in: "p1",
        out: "steps",
      },
      {
        from: "promptTemplate-0",
        to: "output-0",
        in: "instructions",
        out: "prompt",
      },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              dish: {
                type: "string",
              },
              steps: {
                type: "number",
                default: 10,
              },
            },
            required: ["dish", "steps"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              instructions: {
                type: "string",
              },
            },
            required: ["instructions"],
          },
        },
      },
      {
        id: "promptTemplate-0",
        type: "promptTemplate",
        configuration: {
          template: "Write a {{p0}} recipe in under {{p1}} steps",
        },
      },
    ],
  });
});

test("serialization with custom node id and placeholder names", (t) => {
  const dish = input();
  const steps = input({ default: 10 });
  const instructions = prompt`Write a ${promptPlaceholder(dish, {
    name: "dish",
  })} recipe in under ${promptPlaceholder(steps, { name: "steps" })} steps`.configure(
    {
      id: "recipe-template",
    }
  );
  const bgl = serialize(
    board({
      inputs: { dish, steps },
      outputs: { instructions },
    })
  );
  t.deepEqual(bgl, {
    edges: [
      {
        from: "input-0",
        to: "recipe-template",
        in: "dish",
        out: "dish",
      },
      {
        from: "input-0",
        to: "recipe-template",
        in: "steps",
        out: "steps",
      },
      {
        from: "recipe-template",
        to: "output-0",
        in: "instructions",
        out: "prompt",
      },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              dish: {
                type: "string",
              },
              steps: {
                type: "number",
                default: 10,
              },
            },
            required: ["dish", "steps"],
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              instructions: {
                type: "string",
              },
            },
            required: ["instructions"],
          },
        },
      },
      {
        id: "recipe-template",
        type: "promptTemplate",
        configuration: {
          template: "Write a {{dish}} recipe in under {{steps}} steps",
        },
      },
    ],
  });
});

test("error if prompt placeholder name collides with a default one", (t) => {
  const dish = input();
  const steps = input({ default: 10 });
  t.throws(
    () =>
      prompt`Write a ${promptPlaceholder(dish, {
        name: "p1",
      })} recipe in under ${steps} steps`.configure({
        id: "recipe-template",
      }),
    {
      message:
        `Prompt placeholder "p1" has already been used ` +
        `in template starting with "Write a ... recipe in under ... "`,
    }
  );
});
