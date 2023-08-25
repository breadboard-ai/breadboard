/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProbeEvent } from "@google-labs/breadboard";
import { NodeValue } from "@google-labs/graph-runner";

export type DebugPin = (value: NodeValue) => NodeValue | undefined;

type NodePins = Map<string, DebugPin>;

export class DebugProbe extends EventTarget {
  #pins = new Map<string, NodePins>();

  constructor() {
    super();
    this.addEventListener("beforehandler", this.#eventHandler.bind(this));
  }

  #getNodePins(nodeId: string): NodePins {
    if (!this.#pins.has(nodeId)) {
      this.#pins.set(nodeId, new Map());
    }
    return this.#pins.get(nodeId) as NodePins;
  }

  addDebugPin(nodeId: string, inputName: string, debugPin: DebugPin) {
    this.#getNodePins(nodeId).set(inputName, debugPin);
  }

  #eventHandler(event: Event) {
    const e = event as ProbeEvent;
    const { descriptor, inputs } = e.detail;
    const pins = this.#getNodePins(descriptor.id);
    Object.entries(inputs).forEach(([key, value]) => {
      const result = pins.get(key)?.(value);
      if (result !== undefined) {
        inputs[key] = result;
      }
    });
  }
}
