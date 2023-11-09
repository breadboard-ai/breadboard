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
  GraphDescriptor,
  StreamCapability,
  StreamCapabilityType,
  asRuntimeKit,
  callHandler,
} from "@google-labs/breadboard";
import NodeNurseryWeb from "../src/index.js";
import Starter from "@google-labs/llm-starter";

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
    },
  };
  const outputs = (await callHandler(transformStream, inputs, {})) as {
    stream: StreamCapabilityType<number>;
  };
  const results = await toArray<number>(outputs.stream.stream);
  t.deepEqual(results, [1, 2, 3]);
});

test("transform works in a board", async (t) => {
  const board = new Board();
  const nursery = board.addKit(NodeNurseryWeb);

  board.input().wire(
    "stream->",
    nursery
      .transformStream((board, input, output) => {
        const starter = board.addKit(Starter);

        function run({ chunk }: { chunk: number }): string {
          return `number: ${chunk}`;
        }

        input.wire(
          "chunk->",
          starter
            .runJavascript("run", {
              code: run.toString(),
            })
            .wire("result->chunk", output)
        );
      })
      .wire("stream->", board.output())
  );

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    },
  });

  const outputs = (await board.runOnce(
    {
      stream: new StreamCapability<number>(stream),
    },
    {
      kits: [asRuntimeKit(Starter)],
    }
  )) as {
    stream: StreamCapabilityType<number>;
  };
  const results = await toArray<number>(outputs.stream.stream);
  t.deepEqual(results, ["number: 1", "number: 2", "number: 3"]);
});
