/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  OutputValues,
  StreamCapability,
} from "@google-labs/breadboard";

export default {
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { list } = inputs;
    if (!list) throw new Error("The `list` input is required");
    if (!Array.isArray(list))
      throw new Error("The `list` input must be an array");
    const stream = new ReadableStream({
      async start(controller) {
        for (const item of list) {
          controller.enqueue({ chunk: item });
          controller.enqueue({ chunk: " " });
        }
        controller.close();
      },
    });
    return { stream: new StreamCapability(stream) };
  },
};
