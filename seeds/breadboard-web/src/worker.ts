/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MessageController,
  WorkerRuntime,
} from "@google-labs/breadboard/worker";
import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const controller = new MessageController(self as unknown as Worker);
const runtime = new WorkerRuntime(controller);

const url = await runtime.onload();
const board = await Board.load(url, {
  importedKits: { "@google-labs/llm-starter": Starter },
});

await runtime.run(board);
