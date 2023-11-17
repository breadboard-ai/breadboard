/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RunResult } from "../run.js";
import { BoardRunner } from "../runner.js";
import { AnyRunRequestMessage, ServerBidirectionalStream } from "./protocol.js";

const resumeRun = (request: AnyRunRequestMessage) => {
  const [type, , state] = request;
  const result = state ? RunResult.load(state) : undefined;
  if (result && type === "input") {
    const [, inputs] = request;
    result.inputs = inputs.inputs;
  }
  return result;
};

export const server = async (
  stream: ServerBidirectionalStream,
  runner: BoardRunner
) => {
  const requestReader = stream.readableRequests.getReader();
  let request = await requestReader.read();
  if (request.done) return;

  const result = resumeRun(request.value);

  const responses = stream.writableResponses.getWriter();
  try {
    for await (const stop of runner.run(undefined, result)) {
      if (stop.type === "input") {
        const state = await stop.save();
        await responses.write(["input", stop, state]);
        request = await requestReader.read();
        if (request.done) {
          await responses.close();
          return;
        } else {
          const [type, inputs] = request.value;
          if (type === "input") {
            stop.inputs = inputs.inputs;
          }
        }
      } else if (stop.type === "output") {
        await responses.write(["output", stop]);
      } else if (stop.type === "beforehandler") {
        await responses.write(["beforehandler", stop]);
      }
    }
    await responses.write(["end", {}]);
    await responses.close();
  } catch (e) {
    await responses.abort(e);
  }
};
