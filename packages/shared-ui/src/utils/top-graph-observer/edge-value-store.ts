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
  NodeIdentifier,
} from "@google-labs/breadboard";
import type { ComparableEdge, TopGraphEdgeInfo } from "../../types/types";
import { ComparableEdgeImpl } from "./comparable-edge";

type EdgeValueStoreMap = Map<string, TopGraphEdgeInfo[]>;
type IncomingEdgeMap = Map<NodeIdentifier, Edge[]>;
export class EdgeValueStore {
  #values: EdgeValueStoreMap;
  #lastEdge: ComparableEdgeImpl | null;
  #incomingEdges: IncomingEdgeMap;

  constructor(
    values: EdgeValueStoreMap = new Map(),
    incomingEdges: IncomingEdgeMap = new Map(),
    lastEdge: Edge | null = null
  ) {
    this.#values = values;
    this.#incomingEdges = incomingEdges;
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

  #getIncomingEdges(nodeId: NodeIdentifier) {
    return this.#incomingEdges.get(nodeId) || [];
  }

  #addIncomingEdge(edge: Edge) {
    const { to } = edge;
    if (!this.#incomingEdges.has(to)) {
      this.#incomingEdges.set(to, [edge]);
    } else {
      this.#incomingEdges.get(to)!.push(edge);
    }
  }

  setConsumed(nodeId: NodeIdentifier): EdgeValueStore {
    const consumedEdges = this.#getIncomingEdges(nodeId);
    for (const edge of consumedEdges) {
      const key = this.#keyFromEdge(edge);
      if (!this.#values.has(key)) {
        console.warn(
          "A value that wasn't stored was received. This is likely a bug elsewhere"
        );
        return this;
      }
      const edgeValues = this.#values.get(key)!;
      const lastInfo = edgeValues.at(-1);
      if (!lastInfo) {
        console.warn(
          `Empty values for "${key}" is very unlikely. Probably a bug somwehere`
        );
        return this;
      }
      lastInfo.status = "consumed";
    }
    return new EdgeValueStore(
      this.#values,
      this.#incomingEdges,
      this.#lastEdge?.edge()
    );
  }

  setStored(edges: Edge[], inputs?: InputValues): EdgeValueStore {
    if (!inputs) {
      return this;
    }
    let lastEdge;
    edges.forEach((edge) => {
      this.#addIncomingEdge(edge);
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

    return new EdgeValueStore(this.#values, this.#incomingEdges, lastEdge);
  }

  get current(): ComparableEdge | null {
    return this.#lastEdge;
  }

  get(edge: InspectableEdge): TopGraphEdgeInfo[] {
    const key = this.#keyFromInspectableEdge(edge);
    return this.#values.get(key) || [];
  }
}
