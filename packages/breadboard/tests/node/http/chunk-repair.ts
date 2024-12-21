/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { chunkRepairTransform } from "../../../src/remote/chunk-repair.js";
import { deepStrictEqual } from "node:assert";

const repair = async (incoming: string[], repaired: string[]) => {
  const log: string[] = [];
  const incomingStream = new ReadableStream({
    start(controller) {
      for (const chunk of incoming) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  await incomingStream.pipeThrough(chunkRepairTransform()).pipeTo(
    new WritableStream({
      write(chunk) {
        log.push(chunk);
      },
    })
  );
  deepStrictEqual(log, repaired);
};

describe("Chunk Repair Transform", async () => {
  test("nice chunks", async () => {
    await repair(["foo\n\n", "bar\n\n"], ["foo\n\n", "bar\n\n"]);
  });
  test("broken chunks", async () => {
    await repair(["foo\n", "\nbar\n\n"], ["foo\n\n", "bar\n\n"]);
    await repair(["foo\n\nba", "r\n\n"], ["foo\n\n", "bar\n\n"]);
    await repair(
      ["foo\n\nbar\n\nb", "az\n\n"],
      ["foo\n\n", "bar\n\n", "baz\n\n"]
    );
    await repair(
      ["foo\n\nbar\n\nbaz", "\n\nqux\n\n"],
      ["foo\n\n", "bar\n\n", "baz\n\n", "qux\n\n"]
    );
    await repair(
      ["foo\n\nbar\n\nbaz\n\n", "qux\n\n"],
      ["foo\n\n", "bar\n\n", "baz\n\n", "qux\n\n"]
    );
  });
  test("chunks broken at boundary", async () => {
    await repair(
      ['data: ["input"', ',{"node":{}}]\n', "\n"],
      ['data: ["input",{"node":{}}]\n\n']
    );
  });
});
