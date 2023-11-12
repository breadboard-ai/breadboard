/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { TestClient } from "../helpers/_test-transport.js";
import {
  InputPromiseResponseMessage,
  RunResponseStream,
} from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";
import { RunResult } from "../../src/run.js";

test("Test transport interactions work", async (t) => {
  const clientTransport = new TestClient();
  clientTransport.setServer({
    load: async (request) => {
      return { title: "test", url: request.url };
    },
    run: async () => {
      const response = new ReadableStream({
        pull(controller) {
          controller.enqueue(["end", {}]);
          controller.close();
        },
      }) as RunResponseStream;
      return response;
    },
    proxy: async () => {
      return { outputs: {} };
    },
  });
  t.deepEqual(await clientTransport.load({ url: "hello", proxyNodes: [] }), {
    url: "hello",
    title: "test",
  });
  const response = await clientTransport.run(["run", {}]);
  const reader = response.getReader();
  t.deepEqual(await reader.read(), { done: false, value: ["end", {}] });
  t.deepEqual(await reader.read(), { done: true, value: undefined });
  t.deepEqual(
    await clientTransport.proxy({
      node: { id: "foo", type: "bar" },
      inputs: {},
    }),
    { outputs: {} }
  );
});

test("A board run can feed into a transport", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));
  const clientTransport = new TestClient();
  clientTransport.setServer({
    load: async () => {
      throw t.fail("load should not be called");
    },
    run: async (request) => {
      const [type, , state] = request;
      const result = state ? RunResult.load(state) : undefined;
      if (result && type === "input") {
        const [, inputs] = request;
        result.inputs = inputs.inputs;
      }
      return new ReadableStream({
        async pull(controller) {
          for await (const stop of board.run(undefined, result)) {
            if (stop.type === "input") {
              const state = await stop.save();
              controller.enqueue(["input", stop, state]);
              controller.close();
              return;
            } else if (stop.type === "output") {
              controller.enqueue(["output", stop]);
            } else if (stop.type === "beforehandler") {
              controller.enqueue(["beforehandler", stop]);
            }
          }
          controller.enqueue(["end", {}]);
          controller.close();
        },
      }) as RunResponseStream;
    },
    proxy: async () => {
      throw t.fail("proxy should not be called");
    },
  });
  let intermediateState;
  for await (const result of await clientTransport.run(["run", {}])) {
    const [type, response, state] = result as InputPromiseResponseMessage;
    t.is(type, "input");
    t.is(response.node.type, "input");
    t.deepEqual(response.inputArguments, { foo: "bar" });
    intermediateState = state;
  }
  t.assert(intermediateState !== undefined);
  const secondRunResults = [];
  let outputs;
  for await (const result of await clientTransport.run([
    "input",
    {
      inputs: { hello: "world" },
    },
    intermediateState as string,
  ])) {
    const [type, , state] = result;
    if (type === "output") {
      const [, output] = result;
      outputs = output.outputs;
    }
    t.assert(state === undefined);
    secondRunResults.push(type);
  }
  t.deepEqual(outputs, { hello: "world" });
  t.deepEqual(secondRunResults, ["beforehandler", "output", "end"]);
});
