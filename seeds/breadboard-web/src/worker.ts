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
import { Core } from "@google-labs/core-kit";

const controller = new MessageController(self as unknown as Worker);
const runtime = new WorkerRuntime(controller);

const url = await runtime.onload();
const runner = await Board.load(url, {
  importedKits: {
    "@google-labs/llm-starter": Starter,
    "@google-labs/core-kit": Core,
  },
});

await runtime.run(runner, [Starter, Core]);
