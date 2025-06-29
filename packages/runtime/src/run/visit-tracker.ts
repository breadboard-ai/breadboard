/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier, ReanimationStateVisits } from "@breadboard-ai/types";

/**
 * Tracks paths of visited nodes. Uses the "last visited node" approach.
 * This might not be perfectly accurate, since we don't actually know if
 * the last visited node is the one where the edge comes from.
 * However, it should work well enough in most cases.
 */
export class VisitTracker {
  #visited = new Map<NodeIdentifier, number[]>();

  constructor(visits: ReanimationStateVisits = []) {
    this.#visited = new Map(visits);
  }

  visit(node: string, path: number[]) {
    this.#visited.set(node, path);
  }

  pathFor(node: string): number[] | undefined {
    return this.#visited.get(node);
  }

  visited(): [NodeIdentifier, number[]][] {
    return Array.from(this.#visited.entries());
  }
}
