/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { InputValues } from "@google-labs/graph-runner";
import { Starter } from "@google-labs/llm-starter";
import { MessageController } from "./controller.js";
import { NodeProxy } from "./proxy.js";

const controller = new MessageController(self as unknown as Worker);

const proxy = new NodeProxy(controller, ["generateText", "secrets"]);

const BOARD_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/math.json";

try {
  const board = await Board.load(BOARD_URL, {
    kits: {
      "@google-labs/llm-starter": Starter,
    },
  });

  for await (const stop of board.run(proxy)) {
    if (stop.type === "input") {
      const inputMessage = (await controller.ask({
        type: stop.type,
        node: stop.node,
        inputArguments: stop.inputArguments,
      })) as { data: InputValues };
      stop.inputs = inputMessage.data;
    } else if (stop.type === "output") {
      controller.inform({
        type: stop.type,
        node: stop.node,
        outputs: stop.outputs,
      });
    } else if (stop.type === "beforehandler") {
      controller.inform({
        type: stop.type,
        node: stop.node,
      });
    }
  }
  controller.inform({ type: "end" });
} catch (e) {
  const error = e as Error;
  console.error(error);
  controller.inform({ type: "error", error: error.message });
}
