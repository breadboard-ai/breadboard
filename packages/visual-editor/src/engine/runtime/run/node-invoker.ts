import type {
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
  RunArguments,
} from "@breadboard-ai/types";

import type { NodeInvoker } from "../../types.js";

import { callHandler, getHandler } from "../handler.js";

export { NodeInvokerImpl };

class NodeInvokerImpl implements NodeInvoker {
  async invokeNode(
    args: RunArguments,
    descriptor: NodeDescriptor,
    inputs: InputValues
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs: _inputs, start, stopAfter, ...context } = args;

    let outputs: OutputValues | undefined = undefined;

    const handler = await getHandler(descriptor.type, {
      ...context,
    });

    const newContext: NodeHandlerContext = {
      ...context,
    };

    outputs = (await callHandler(handler, inputs, newContext)) as OutputValues;

    return outputs;
  }
}
