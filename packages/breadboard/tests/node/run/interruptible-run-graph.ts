/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { interruptibleScriptedRun } from "../scripted-run.js";

import invokeWithBubblingInput from "../../bgl/invoke-board-with-bubbling-input.bgl.json" with { type: "json" };
import manyInputs from "../../bgl/many-inputs.bgl.json" with { type: "json" };
import manyOutputs from "../../bgl/many-outputs.bgl.json" with { type: "json" };
import multiLevelInvoke from "../../bgl/multi-level-invoke.bgl.json" with { type: "json" };
import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import mapWithBubblingInputs from "../../bgl/map-with-bubbling-inputs.bgl.json" with { type: "json" };

describe("interruptibleRunGraph end-to-end", async () => {
  test("simple graph", async () => {
    await interruptibleScriptedRun(simple, [
      { expected: { type: "input" }, inputs: { text: "Hello" } },
      { expected: { type: "output", outputs: [{ text: "Hello" }] } },
    ]);
  });

  test("many inputs", async () => {
    await interruptibleScriptedRun(manyInputs, [
      { expected: { type: "input" }, inputs: { text1: "foo" } },
      { expected: { type: "input" }, inputs: { text2: "bar" } },
      {
        expected: {
          type: "output",
          outputs: [
            {
              "text-one": "foo",
              "text-two": "bar",
            },
          ],
        },
      },
    ]);
  });

  test("many outputs", async () => {
    await interruptibleScriptedRun(manyOutputs, [
      { expected: { type: "input" }, inputs: { start: "foo" } },
      {
        expected: {
          type: "output",
          outputs: [{ one: "foo" }, { two: "foo " }],
        },
      },
    ]);
  });

  test("invoke board with a bubbling input", async () => {
    await interruptibleScriptedRun(invokeWithBubblingInput, [
      {
        expected: { type: "input", state: [{ node: "input" }] },
        inputs: { name: "Bob" },
      },
      {
        expected: {
          type: "input",
          state: [{ node: "invoke-b5fe388d" }, { node: "input" }],
        },
        inputs: { location: "New York" },
      },
      {
        expected: {
          type: "output",
          outputs: [
            {
              greeting: 'Greeting is: "Hello, Bob from New York!"',
            },
          ],
        },
      },
    ]);
  });

  test("invoke board multiple levels of nesting and bubbling", async () => {
    await interruptibleScriptedRun(multiLevelInvoke, [
      {
        expected: {
          type: "input",
          state: [{ node: "invoke-d5aa6bf1" }, { node: "input" }],
        },
        inputs: { name: "Bob" },
      },
      {
        expected: {
          type: "input",
          state: [
            { node: "invoke-d5aa6bf1" },
            { node: "invoke-b5fe388d" },
            { node: "input" },
          ],
        },
        inputs: { location: "New York" },
      },
      {
        expected: {
          type: "output",
          outputs: [
            {
              greeting: 'Greeting is: "Hello, Bob from New York!"',
            },
          ],
        },
      },
    ]);
  });

  test("map with bubbling inputs", async () => {
    await interruptibleScriptedRun(mapWithBubblingInputs, [
      {
        expected: {
          type: "input",
          state: [{ node: "map-6088d0ca" }, { node: "input" }],
        },
        inputs: { location: "Neptune" },
      },
      {
        expected: {
          type: "output",
          outputs: [
            {
              greetings: "Hello, Bob from Neptune!",
            },
          ],
        },
      },
    ]);
  });
});
