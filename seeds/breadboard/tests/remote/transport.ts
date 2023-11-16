/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { TestClient } from "../helpers/_test-transport.js";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
  ClientBidirectionalStream,
  InputPromiseResponseMessage,
  RunRequestStream,
  RunResponseStream,
  ServerBidirectionalStream,
} from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";
import { RunResult } from "../../src/run.js";
import { BoardRunner } from "../../src/runner.js";
import { InputValues } from "../../src/types.js";

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

const server = async (
  stream: ServerBidirectionalStream,
  runner: BoardRunner
) => {
  const requestReader = stream.requests.getReader();
  let request = await requestReader.read();
  if (request.done) return;

  const resumeRun = (request: AnyRunRequestMessage) => {
    const [type, , state] = request;
    const result = state ? RunResult.load(state) : undefined;
    if (result && type === "input") {
      const [, inputs] = request;
      result.inputs = inputs.inputs;
    }
    return result;
  };

  const result = resumeRun(request.value);

  const responses = stream.responses.getWriter();
  try {
    for await (const stop of runner.run(undefined, result)) {
      if (stop.type === "input") {
        const state = await stop.save();
        await responses.write(["input", stop, state]);
        request = await requestReader.read();
        if (request.done) {
          await responses.close();
          return;
        } else {
          const [type, inputs] = request.value;
          if (type === "input") {
            stop.inputs = inputs.inputs;
          }
        }
      } else if (stop.type === "output") {
        await responses.write(["output", stop]);
      } else if (stop.type === "beforehandler") {
        await responses.write(["beforehandler", stop]);
      }
    }
    await responses.write(["end", {}]);
    await responses.close();
  } catch (e) {
    await responses.abort(e);
  }
};

test("Interruptible streaming", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const run = async (request: AnyRunRequestMessage) => {
    const requestPipe = new TransformStream<
      AnyRunRequestMessage,
      AnyRunRequestMessage
    >();
    const responsePipe = new TransformStream<
      AnyRunResponseMessage,
      AnyRunResponseMessage
    >();
    server(
      {
        requests: requestPipe.readable as RunRequestStream,
        responses: responsePipe.writable,
      },
      board
    );
    const writer = requestPipe.writable.getWriter();
    writer.write(request);
    writer.close();
    return responsePipe.readable as RunResponseStream;
  };

  let intermediateState;
  for await (const result of await run(["run", {}])) {
    const [type, response, state] = result as InputPromiseResponseMessage;
    t.is(type, "input");
    t.is(response.node.type, "input");
    t.deepEqual(response.inputArguments, { foo: "bar" });
    intermediateState = state;
  }
  t.assert(intermediateState !== undefined);
  const secondRunResults = [];
  let outputs;
  for await (const result of await run([
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

test("Continuous streaming", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const requestPipe = new TransformStream<
    AnyRunRequestMessage,
    AnyRunRequestMessage
  >();
  const responsePipe = new TransformStream<
    AnyRunResponseMessage,
    AnyRunResponseMessage
  >();
  server(
    {
      requests: requestPipe.readable as RunRequestStream,
      responses: responsePipe.writable,
    },
    board
  );
  const writer = requestPipe.writable.getWriter();
  const reader = responsePipe.readable.getReader();

  writer.write(["run", {}]);
  const firsResult = await reader.read();
  t.assert(!firsResult.done);
  t.like(firsResult.value, [
    "input",
    { node: { type: "input" }, inputArguments: { foo: "bar" } },
  ]);
  writer.write(["input", { inputs: { hello: "world" } }, ""]);
  const secondResult = await reader.read();
  t.assert(!secondResult.done);
  t.like(secondResult.value, ["beforehandler", { node: { type: "noop" } }]);
  const thirdResult = await reader.read();
  t.assert(!thirdResult.done);
  t.like(thirdResult.value, ["output", { outputs: { hello: "world" } }]);
  const fourthResult = await reader.read();
  t.assert(!fourthResult.done);
  t.like(fourthResult.value, ["end", {}]);
  const fifthResult = await reader.read();
  t.assert(fifthResult.done);
});

test("Very simple runOnce client", async (t) => {
  const runOnceClient = async (
    stream: ClientBidirectionalStream,
    inputs: InputValues
  ) => {
    const responses = stream.responses;
    const requests = stream.requests.getWriter();

    let outputs;

    await requests.write(["run", {}]);
    for await (const response of responses) {
      const [type, , state] = response;
      if (type === "input") {
        await requests.write(["input", { inputs }, state]);
      } else if (type === "output") {
        const [, output] = response;
        outputs = output.outputs;
        break;
      }
    }
    await responses.cancel();
    await requests.close();
    return outputs;
  };

  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const requestPipe = new TransformStream<
    AnyRunRequestMessage,
    AnyRunRequestMessage
  >();
  const responsePipe = new TransformStream<
    AnyRunResponseMessage,
    AnyRunResponseMessage
  >();
  server(
    {
      requests: requestPipe.readable as RunRequestStream,
      responses: responsePipe.writable,
    },
    board
  );

  const outputs = await runOnceClient(
    {
      requests: requestPipe.writable,
      responses: responsePipe.readable as RunResponseStream,
    },
    { hello: "world" }
  );

  t.deepEqual(outputs, { hello: "world" });
});
