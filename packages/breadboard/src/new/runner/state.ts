/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AbstractNode, InputValues, EdgeInterface } from "./types.js";

class State {
  queue: AbstractNode[] = [];
  inputs: Map<AbstractNode, Partial<InputValues>> = new Map();
  constants: Map<AbstractNode, Partial<InputValues>> = new Map();
  controlWires: Map<AbstractNode, AbstractNode[]> = new Map();
  haveRun: Set<AbstractNode> = new Set();

  receiveInputs(node: AbstractNode, edge: EdgeInterface, inputs: InputValues) {
    const data =
      edge.out === "*"
        ? inputs
        : edge.out === ""
        ? {}
        : inputs[edge.out] !== undefined
        ? { [edge.in]: inputs[edge.out] }
        : {};
    if (edge.constant)
      this.constants.set(node, { ...this.constants.get(node), ...data });
    this.inputs.set(node, { ...this.inputs.get(node), ...data });

    if (edge.in === "")
      this.controlWires.set(node, [
        ...(this.controlWires.get(node) ?? []),
        edge.from,
      ]);

    // return which wires were used
    return Object.keys(data);
  }

  /**
   * Compute required inputs from edges and compare with present inputs
   *
   * Required inputs are
   *  - for all named incoming edges, the presence of any data, irrespective of
   *    which node they come from
   *  - at least one of the incoming empty or * wires, if present (TODO: Is that
   *    correct?)
   *  - data from at least one node if it already ran
   *
   * @returns false if none are missing, otherwise string[] of missing inputs.
   * NOTE: A node with no incoming wires returns an empty array after  first
   * run.
   */
  missingInputs(node: AbstractNode): string[] | false {
    if (node.incoming.length === 0 && this.haveRun.has(node)) return [];

    const requiredKeys = new Set(node.incoming.map((edge) => edge.in));

    const presentKeys = new Set([
      ...Object.keys(node.configuration),
      ...Object.keys(this.inputs.get(node) ?? {}),
      ...Object.keys(this.constants.get(node) ?? {}),
    ]);
    if (this.controlWires.get(node)?.length) presentKeys.add("");

    const missingInputs = [...requiredKeys].filter(
      (key) => !presentKeys.has(key)
    );
    return missingInputs.length ? missingInputs : false;
  }

  getInputs<I extends InputValues>(node: AbstractNode<I>): I {
    return { ...node.configuration, ...(this.inputs.get(node) as I) };
  }

  hasRun(node: AbstractNode) {
    // Mark as run, clear inputs, reset with constants
    this.haveRun.add(node);
    this.inputs.set(node, this.constants.get(node) ?? {});
    this.controlWires.delete(node);
  }

  reset() {
    this.queue = [];
    this.inputs = new Map();
    this.constants = new Map();
    this.controlWires = new Map();
    this.haveRun = new Set();
  }
}
