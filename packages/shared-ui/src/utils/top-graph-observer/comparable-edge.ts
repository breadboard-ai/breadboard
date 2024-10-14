/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, InspectableEdge } from "@google-labs/breadboard";
import type { ComparableEdge } from "../../types/types";

export class ComparableEdgeImpl implements ComparableEdge {
  #edge: Edge;

  #fixUpStarEdge(edge: Edge): Edge {
    if (edge.out === "*") {
      return { ...edge, in: "" };
    }
    return edge;
  }

  constructor(edge: Edge) {
    this.#edge = this.#fixUpStarEdge(edge);
  }

  edge() {
    return this.#edge;
  }

  equals(other: InspectableEdge): boolean {
    return (
      this.#edge.from === other.from.descriptor.id &&
      this.#edge.to === other.to.descriptor.id &&
      this.#edge.in === other.in &&
      this.#edge.out === other.out
    );
  }
}
