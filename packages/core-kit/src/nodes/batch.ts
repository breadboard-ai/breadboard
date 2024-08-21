/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeHandlerObject,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";

export type BatcherInputs = InputValues & {
  /**
   * The list to iterate over.
   */
  list: NodeValue[];
  /**
   * The size of each batch.
   */
  size: number;
};

export type BatcherOutputs = InputValues & {
  /**
   * List of lists that batched into the specified size.
   */
  list: NodeValue[];
};

export default {
  metadata: {
    deprecated: true,
  },
  invoke: async (inputs: InputValues): Promise<OutputValues> => {
    const { list, size } = inputs as BatcherInputs;
    if (!list) throw new Error("Batcher requires `list` input");
    if (!size) throw new Error("Batcher requires `size` input");
    if (!list.length) return { list: [[]] };
    const batches = [];
    for (let i = 0; i < list.length; i += size) {
      batches.push(list.slice(i, i + size));
    }
    return { list: batches };
  },
} satisfies NodeHandlerObject;
