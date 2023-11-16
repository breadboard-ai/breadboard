/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues } from "../types.js";
import { ClientBidirectionalStream } from "./protocol.js";

export const runOnceClient = async (
  stream: ClientBidirectionalStream,
  inputs: InputValues
) => {
  const responses = stream.responses;
  const requests = stream.requests.getWriter();

  let outputs;

  await requests.write(["run", {}]);
  for await (const response of responses) {
    const [type, , state] = response;
    if (type === "input") {
      await requests.write(["input", { inputs }, state]);
    } else if (type === "output") {
      const [, output] = response;
      outputs = output.outputs;
      break;
    }
  }
  await responses.cancel();
  await requests.close();
  return outputs;
};
