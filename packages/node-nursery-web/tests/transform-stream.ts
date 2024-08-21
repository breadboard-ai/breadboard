/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import transformStream, {
  TransformStreamInputs,
} from "../src/nodes/transform-stream.js";
import {
  Board,
  BreadboardCapability,
  GraphDescriptor,
  StreamCapability,
  StreamCapabilityType,
  callHandler,
} from "@google-labs/breadboard";

const toArray = async <T>(stream: ReadableStream<T>) => {
  const results: T[] = [];
  await stream.pipeTo(
    new WritableStream<T>({
      write(chunk) {
        results.push(chunk);
      },
    })
  );
  return results;
};

test("transform stream noop", async (t) => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    },
  });
  const inputs: TransformStreamInputs = {
    stream: new StreamCapability(stream),
  };
  const outputs = (await callHandler(transformStream, inputs, {})) as {
    stream: StreamCapabilityType<number>;
  };
  const results = await toArray<number>(outputs.stream.stream);
  t.deepEqual(results, [1, 2, 3]);
});

test("transform stream noop with text decoding", async (t) => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode("one"));
      controller.enqueue(encoder.encode("two"));
      controller.enqueue(encoder.encode("three"));
      controller.close();
    },
  });
  const inputs: TransformStreamInputs = {
    stream: new StreamCapability(stream),
    decode: true,
  };
  const outputs = (await callHandler(transformStream, inputs, {})) as {
    stream: StreamCapabilityType<number>;
  };
  const results = await toArray<number>(outputs.stream.stream);
  t.deepEqual(results, ["one", "two", "three"]);
});

test("transform stream with a board", async (t) => {
  const board = new Board();
  board.input().wire("chunk->", board.output());

  const graph = board as GraphDescriptor;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    },
  });
  const inputs: TransformStreamInputs = {
    stream: new StreamCapability(stream),
    board: {
      kind: "board",
      board: graph,
    } as BreadboardCapability,
  };
  const outputs = (await callHandler(transformStream, inputs, {})) as {
    stream: StreamCapabilityType<number>;
  };
  const results = await toArray<number>(outputs.stream.stream);
  t.deepEqual(results, [{ chunk: 1 }, { chunk: 2 }, { chunk: 3 }]);
});
