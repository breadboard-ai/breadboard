/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectableGraph } from "./types.js";

export { inspectableGraph } from "./graph.js";

export const getGraphAPI = (inspectableGraph: InspectableGraph) => {
  const inputs = inspectableGraph.nodesByType("input");
  const outputs = inspectableGraph.nodesByType("output");
  return {
    inputs,
    outputs,
  };
};
