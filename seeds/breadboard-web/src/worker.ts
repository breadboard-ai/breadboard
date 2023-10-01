/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { InputValues } from "@google-labs/graph-runner";
import { Starter } from "@google-labs/llm-starter";
import {
  LoadResponseMessage,
  type BeforehandlerMessage,
  type EndMessage,
  type ErrorMessage,
  type InputRequestMessage,
  type LoadRequestMessage,
  type OutputMessage,
  type StartMesssage,
  InputResponseMessage,
} from "./protocol.js";
import { MessageController } from "./controller.js";
import { NodeProxy } from "./proxy.js";

const controller = new MessageController(self as unknown as Worker);

const load = async (): Promise<LoadRequestMessage> => {
  const message = (await controller.listen()) as LoadRequestMessage;
  if (message.type === "load") {
    const data = message.data;
    if (!data.url) {
      throw new Error("The load message must include a url");
    } else if (!data.proxyNodes || !data.proxyNodes.length) {
      console.warn(
        "No nodes to proxy were specified. The board may not run correctly"
      );
    }
    return message;
  }
  throw new Error('The only valid first message is the "load" message');
};

const start = async () => {
  const message = (await controller.listen()) as StartMesssage;
  if (message.type !== "start") {
    throw new Error(
      'The only valid message at this point is the "start" message'
    );
  }
};

try {
  const loadRequest = await load();

  const proxy = new NodeProxy(controller, loadRequest.data.proxyNodes);

  const board = await Board.load(loadRequest.data.url, {
    kits: { "@google-labs/llm-starter": Starter },
  });

  controller.reply<LoadResponseMessage>(
    loadRequest.id,
    {
      title: board.title,
      description: board.description,
      version: board.version,
    },
    "load"
  );

  await start();

  for await (const stop of board.run(proxy)) {
    if (stop.type === "input") {
      const inputMessage = (await controller.ask<
        InputRequestMessage,
        InputResponseMessage
      >(
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
