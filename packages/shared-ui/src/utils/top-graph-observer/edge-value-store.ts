/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type NodeValue,
  type Edge,
  type InspectableEdge,
  InspectableEdgeType,
  type InputValues,
} from "@google-labs/breadboard";
import type { ComparableEdge } from "../../types/types";
import { ComparableEdgeImpl } from "./comparable-edge";

type EdgeValueStoreMap = Map<string, NodeValue[]>;
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

  set(edge: Edge, inputs: InputValues | undefined): EdgeValueStore {
    if (!inputs) {
      return this;
    }
    const value = edge.out === "*" || !edge.in ? inputs : inputs[edge.in];
    const key = this.#keyFromEdge(edge);
    if (!this.#values.has(key)) {
      this.#values.set(key, [value]);
    } else {
      const edgeValues = this.#values.get(key);
      this.#values.set(key, [...edgeValues!, value]);
    }
    return new EdgeValueStore(this.#values, edge);
  }

  get current(): ComparableEdge | null {
    return this.#lastEdge;
  }

  get(edge: InspectableEdge): NodeValue[] {
    const key = this.#keyFromInspectableEdge(edge);
    return this.#values.get(key) || [];
  }
}
