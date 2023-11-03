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
// NOTE: We have to tie this to the latest *public* version of Breadboard, not the local version.
const runner = await Board.load(url, {
  "kits": {
    "@google-labs/llm-starter": Starter
  }
});

await runtime.run(runner);
