/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capability,
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";

export type MapInputs = InputValues & {
  /**
   * The list to iterate over.
   */
  list: NodeValue[];

  /**
   * The graph to run for each element of the list.
   */
  graph?: Capability;
};

export type MapOutputs = OutputValues & {
  /**
   * The list of outputs from the graph.
   */
  list: NodeValue[];
};

export default async (inputs: InputValues): Promise<OutputValues> => {
  const { list } = inputs as MapInputs;
  if (!Array.isArray(list)) {
    throw new Error(`Expected list to be an array, but got ${list}`);
  }
  return { list };
};
