/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { readFile, readdir } from "fs/promises";

import { TraversalMachine } from "../src/index.js";

import {
  ErrorCapability,
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "../src/types.js";
import { MachineResult } from "../src/traversal/result.js";

const IN_DIR = "./tests/data/";

interface TestGraphDescriptor extends GraphDescriptor {
  sequence: string[];
  inputs: InputValues;
  outputs: OutputValues[];
  throws: boolean;
}

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

await Promise.all(
  graphs.map(async (filename) => {
    test(filename, async (t) => {
      const data = await readFile(`${IN_DIR}${filename}`, "utf-8");
      const graph = JSON.parse(data) as TestGraphDescriptor;
      if (graph.title?.includes("skip")) {
        t.pass();
        t.log("Skipped");
        return;
      }
      const machine = new TraversalMachine(graph);
      const outputs: OutputValues[] = [];
      const sequence: string[] = [];
      const run = async () => {
        for await (const result of machine) {
          if (result.skip) continue;
          const { inputs, descriptor } = result;
          sequence.push(descriptor.id);
          switch (descriptor.type) {
            case "input":
              result.outputsPromise = Promise.resolve(graph.inputs);
              break;
            case "output":
              outputs.push({ ...inputs });
              break;
            case "extract": {
              const list = result.inputs.list as string[];
              const text = list.shift();
              result.outputsPromise = Promise.resolve(
                list.length ? { list, text } : { text }
              );
              break;
            }
            case "error": {
              result.outputsPromise = Promise.resolve({
                $error: {
                  kind: "error",
                  error: new Error("Test error"),
                } as ErrorCapability,
              });
              break;
            }
            case "throw": {
              result.outputsPromise = Promise.reject(new Error("Test throw"));
              break;
            }
            case "noop":
              result.outputsPromise = Promise.resolve({ ...inputs });
              break;
            default:
              throw new Error(`Unknown node: ${descriptor.id}`);
          }
        }
      };
      if (graph.throws) await t.throwsAsync(run);
      else await run();

      // Rewrite instancesof Error to strings for comparison.
      outputs.forEach((output) => {
        if (output.$error) {
          const $error = output.$error as ErrorCapability;
          if ($error.error) {
            t.true($error.error instanceof Error);
            output.$error = { ...$error, error: "instanceof Error" };
          }
        }
      });

      t.deepEqual(outputs, graph.outputs);
      t.deepEqual(sequence, graph.sequence);
    });
  })
);

test("Can be interrupted and resumed", async (t) => {
  const data = await readFile(`${IN_DIR}one-entry.json`, "utf-8");
  const graph = JSON.parse(data) as TestGraphDescriptor;
  let result: MachineResult;

  // First iteration.
  {
    const machine = new TraversalMachine(graph);
    const iterator = machine.start();
    const iteratorResult = await iterator.next();
    result = iteratorResult.value;
    const { descriptor, skip } = iteratorResult.value;
    t.false(skip);
    t.false(iteratorResult.done);
    t.like(descriptor, {
      id: "node-a",
      type: "input",
    });
    result.outputsPromise = Promise.resolve(graph.inputs);
  }

  // Second iteration.
  {
    const machine = new TraversalMachine(graph, result);
    const iterator = machine.start();
    const iteratorResult = await iterator.next();
    result = iteratorResult.value;
    const { skip } = iteratorResult.value;
    t.true(skip);
  }

  // Third iteration.
  {
    const machine = new TraversalMachine(graph, result);
    const iterator = machine.start();
    const iteratorResult = await iterator.next();
    result = iteratorResult.value;
    const { descriptor, skip } = iteratorResult.value;
    t.false(skip);
    t.like(descriptor, {
      id: "node-b",
      type: "noop",
    });
    result.outputsPromise = Promise.resolve(result.inputs);
  }

  // Fourth iteration.
  {
    const machine = new TraversalMachine(graph, result);
    const iterator = machine.start();
    const iteratorResult = await iterator.next();
    result = iteratorResult.value;
    const { descriptor } = iteratorResult.value;
    t.like(descriptor, {
      id: "node-c",
      type: "output",
    });
  }

  t.deepEqual(result.inputs, graph.outputs[0]);
});
