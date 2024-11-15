/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardCapability,
  InputValues,
  NodeHandlerContext,
  NodeHandlerObject,
  OutputValues,
  StreamCapability,
  StreamCapabilityType,
  getGraphDescriptor,
  invokeGraph,
  isStreamCapability,
} from "@google-labs/breadboard";

export type TransformStreamInputs = InputValues & {
  stream: StreamCapabilityType;
  decode?: boolean;
  board?: BreadboardCapability;
};

const getTransformer = async (
  board?: BreadboardCapability,
  context?: NodeHandlerContext
): Promise<Transformer> => {
  if (board) {
    const runnableBoard = await getGraphDescriptor(
      board as BreadboardCapability,
      context
    );
    if (!runnableBoard.success) throw new Error("Invalid board");
    // Because stream transformers run outside of the normal board lifecycle,
    // they will not have access to `probe` capabilities and thus will not
    // send diagnostics back.
    // We need to figure out how enable this.
    return {
      async transform(chunk, controller) {
        const inputs = { chunk };
        const result = await invokeGraph(runnableBoard, inputs, {
          ...context,
          // TODO: figure out how to send diagnostics from streams transformer.
          probe: undefined,
        });
        controller.enqueue({ chunk: result.chunk });
      },
    };
  } else
    return {
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    };
};

export default {
  metadata: {
    deprecated: true,
  },
  invoke: async (
    inputs: InputValues,
    context?: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { stream, board, decode = false } = inputs as TransformStreamInputs;
    if (!stream) throw new Error("The `stream` input is required");
    if (!isStreamCapability(stream))
      throw new Error("The `stream` input must be a `StreamCapability`.");
    const transformer = await getTransformer(board, context);
    const streamCapability = stream as StreamCapabilityType;
    const decoder = decode ? new TextDecoderStream() : new TransformStream();
    const outputStream = streamCapability.stream
      .pipeThrough(decoder)
      .pipeThrough(new TransformStream(transformer));
    return { stream: new StreamCapability<object>(outputStream) };
  },
} satisfies NodeHandlerObject;
