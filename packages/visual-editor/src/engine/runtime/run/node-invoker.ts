import type {
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
  RunArguments,
} from "@breadboard-ai/types";

import type { NodeInvoker } from "../../types.js";

import { callHandler, getHandler } from "../handler.js";

export { defaultInvokeNode };

const defaultInvokeNode: NodeInvoker = async (
  args: RunArguments,
  descriptor: NodeDescriptor,
  inputs: InputValues
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inputs: _inputs, start, stopAfter, ...context } = args;

  const handler = await getHandler(descriptor.type, {
    ...context,
  });

  const newContext: NodeHandlerContext = {
    ...context,
  };

  return (await callHandler(handler, inputs, newContext)) as OutputValues;
};
