/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { InputValues } from "@google-labs/graph-runner";
import { Starter } from "@google-labs/llm-starter";
import {
  BeforehandlerMessage,
  EndMessage,
  ErrorMessage,
  InputRequestMessage,
  MessageController,
  OutputMessage,
  StartMesssage,
} from "./controller.js";
import { NodeProxy } from "./proxy.js";

const controller = new MessageController(self as unknown as Worker);

type StartupData = StartMesssage["data"];

const start = async (): Promise<StartupData> => {
  const message = (await controller.listen()) as {
    type: string;
    data: StartupData;
  };
  if (message.type === "start") {
    const data = message.data;
    if (!data.url) {
      throw new Error("The start message must include a url");
    } else if (!data.proxyNodes || !data.proxyNodes.length) {
      console.warn(
        "No nodes to proxy were specified. The board may not run correctly"
      );
    }
    return message.data;
  }
  throw new Error('The only valid first message is the "start" message');
};

const info = await start();

const proxy = new NodeProxy(controller, info.proxyNodes);

try {
  const board = await Board.load(info.url, {
    kits: { "@google-labs/llm-starter": Starter },
  });

  for await (const stop of board.run(proxy)) {
    if (stop.type === "input") {
      const inputMessage = (await controller.ask<InputRequestMessage>(
        {
          node: stop.node,
          inputArguments: stop.inputArguments,
        },
        stop.type
      )) as { data: InputValues };
      stop.inputs = inputMessage.data;
    } else if (stop.type === "output") {
      controller.inform<OutputMessage>(
        {
          node: stop.node,
          outputs: stop.outputs,
        },
        stop.type
      );
    } else if (stop.type === "beforehandler") {
      controller.inform<BeforehandlerMessage>(
        {
          node: stop.node,
        },
        stop.type
      );
    }
  }
  controller.inform<EndMessage>({}, "end");
} catch (e) {
  const error = e as Error;
  console.error(error);
  controller.inform<ErrorMessage>({ error: error.message }, "error");
}
