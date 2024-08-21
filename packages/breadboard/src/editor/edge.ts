/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { EditableEdgeSpec } from "./types.js";

export const findEdgeIndex = (
  graph: GraphDescriptor,
  spec: EditableEdgeSpec
) => {
  return graph.edges.findIndex((edge) => {
    return edgesEqual(spec, edge);
  });
};

export const edgesEqual = (a: EditableEdgeSpec, b: EditableEdgeSpec) => {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.out === b.out &&
    a.in === b.in &&
    b.constant === b.constant
  );
};
