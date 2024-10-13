/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Edge,
  type InspectableEdge,
  InspectableEdgeType,
  type InputValues,
} from "@google-labs/breadboard";
import type { ComparableEdge, TopGraphEdgeInfo } from "../../types/types";
import { ComparableEdgeImpl } from "./comparable-edge";

type EdgeValueStoreMap = Map<string, TopGraphEdgeInfo[]>;
export class EdgeValueStore {
  #values: EdgeValueStoreMap;
  #lastEdge: ComparableEdge | null;

  constructor(
    values: EdgeValueStoreMap = new Map(),
    lastEdge: Edge | null = null
  ) {
    this.#values = values;
    this.#lastEdge = lastEdge ? new ComparableEdgeImpl(lastEdge) : null;
  }

  #key(
    from: string,
    out: string,
    to: string,
    iN: string,
    constant: boolean | undefined
  ) {
    return `${from}|${out}|${to}|${iN}|${constant === true ? "c" : ""}`;
  }

  #keyFromEdge(edge: Edge): string {
    return this.#key(
      edge.from,
      edge.out || "",
      edge.to,
      (edge.out === "*" ? "*" : edge.in) || "",
      edge.constant
    );
  }

  #keyFromInspectableEdge(edge: InspectableEdge): string {
    const from = edge.from.descriptor.id;
    const out = edge.out;
    const to = edge.to.descriptor.id;
    const iN = edge.in;
    const constant = edge.type === InspectableEdgeType.Constant;
    return this.#key(from, out, to, iN, constant);
  }

  // TODO: Rename to setStored
  setAll(edges: Edge[], inputs?: InputValues): EdgeValueStore {
    if (!inputs) {
      return this;
    }
    let lastEdge;
    edges.forEach((edge) => {
      const name = edge.out;
      const value = name === "*" || !name ? inputs : inputs[name];
      const key = this.#keyFromEdge(edge);
      const info: TopGraphEdgeInfo = { status: "stored", value };
      if (!this.#values.has(key)) {
        this.#values.set(key, [info]);
      } else {
        const edgeValues = this.#values.get(key);
        this.#values.set(key, [...edgeValues!, info]);
      }
      lastEdge = edge;
    });

    return new EdgeValueStore(this.#values, lastEdge);
  }

  get current(): ComparableEdge | null {
    return this.#lastEdge;
  }

  get(edge: InspectableEdge): TopGraphEdgeInfo[] {
    const key = this.#keyFromInspectableEdge(edge);
    return this.#values.get(key) || [];
  }
}
