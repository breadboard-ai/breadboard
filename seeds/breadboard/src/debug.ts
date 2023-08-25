/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeValue } from "@google-labs/graph-runner";
import { ProbeEvent } from "./types.js";

export type DebugPin = (value: NodeValue) => NodeValue | undefined;

type NodePins = Map<string, DebugPin>;

export class DebugProbe extends EventTarget {
  #inputPins = new Map<string, NodePins>();

  /**
   * Creates a new DebugProbe.
   *
   * A `DebugProbe` can be used to examine and modify the inputs to a node
   * as the board is running.
   *
   * @example
   * ```ts
   * const probe = new DebugProbe();
   * probe.addInputPin("node-id", "input-name", (value) => value + 1);
   *
   * const board = new Board();
   * board.runOnce(probe);
   * ```
   */
  constructor() {
    super();
    this.addEventListener("beforehandler", this.#onBeforeHandler.bind(this));
  }

  #getInputPins(nodeId: string): NodePins {
    if (!this.#inputPins.has(nodeId)) {
      this.#inputPins.set(nodeId, new Map());
    }
    return this.#inputPins.get(nodeId) as NodePins;
  }

  /**
   * Adds a pin to a node's input. The pin function will be called before the
   * node's handler is called. If the pin function returns a value, that value
   * will be used as the input value. If the pin function returns undefined,
   * the input value will not be modified.
   *
   * @param nodeId - id of the node to add the pin to
   * @param inputName - name of the input to pin
   * @param debugPin - the pin function. It takes in the input value as its
   * only argument and returns a new value or undefined.
   */
  addInputPin(nodeId: string, inputName: string, debugPin: DebugPin) {
    this.#getInputPins(nodeId).set(inputName, debugPin);
  }

  #onBeforeHandler(event: Event) {
    const e = event as ProbeEvent;
    const { descriptor, inputs } = e.detail;
    const pins = this.#getInputPins(descriptor.id);
    Object.entries(inputs).forEach(([key, value]) => {
      const result = pins.get(key)?.(value);
      if (result !== undefined) {
        inputs[key] = result;
      }
    });
  }
}
