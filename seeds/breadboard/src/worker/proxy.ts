/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeHandlerContext,
  NodeTypeIdentifier,
} from "../types.js";

import type { ProxyRequestMessage, ProxyResponseMessage } from "./protocol.js";
import { MessageController } from "./controller.js";
import { KitBuilder } from "../kits/builder.js";

export const makeProxyKit = (
  proxyNodes: NodeTypeIdentifier[],
  controller: MessageController
) => {
  const proxiedNodes = Object.fromEntries(
    proxyNodes.map((node) => {
      return [
        node,
        {
          invoke: async (inputs: InputValues, context: NodeHandlerContext) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const descriptor = context.descriptor!;
            const message = { type: "proxy", node: descriptor, inputs };
            const result = (await controller.ask<
              ProxyRequestMessage,
              ProxyResponseMessage
            >(message, "proxy")) as ProxyResponseMessage;
            return result.data;
          },
        },
      ];
    })
  );

  return new KitBuilder({ url: "proxy" }).build(proxiedNodes);
};
