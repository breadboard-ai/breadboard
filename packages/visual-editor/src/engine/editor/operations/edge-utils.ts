/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge as EdgeDescriptor } from "@breadboard-ai/types";

/**
 * This helper is necessary because both "*" and "" are valid representations
 * of a wildcard edge tail. This function ensures that the edge is always
 * consistent.
 * @param edge -- the edge to fix up
 * @returns
 */
export const fixUpStarEdge = (edge: EdgeDescriptor): EdgeDescriptor => {
  if (edge.out === "*") {
    return { ...edge, in: "" };
  }
  return edge;
};

/**
 * This is inverse of the helper above, necessary when working with
 * instances of `InspectableEdge` directly, since they will show "*" on both
 * sides of the edge.
 * @param edge -- the edge to un-fix up
 * @returns
 */
export const unfixUpStarEdge = (edge: EdgeDescriptor): EdgeDescriptor => {
  if (edge.out === "*") {
    return { ...edge, in: "*" };
  }
  return edge;
};

export const fixupConstantEdge = (edge: EdgeDescriptor): EdgeDescriptor => {
  const { constant, ...rest } = edge;
  if (constant === false) {
    return rest;
  }
  return edge;
};
