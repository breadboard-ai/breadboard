/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  BreadboardCapability,
  InputValues,
  NodeHandlerContext,
  OutputValues,
  StreamCapability,
  StreamCapabilityType,
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
    const runnableBoard = await Board.fromBreadboardCapability(
      board as BreadboardCapability
    );
    return {
      async transform(chunk, controller) {
        const inputs = { chunk };
        const result = await runnableBoard.runOnce(inputs, context);
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
};
