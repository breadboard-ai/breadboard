/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";
import { ProbeEvent } from "./types.js";

export type DebugPin = (value: NodeValue) => NodeValue | undefined;

export type DebugNodePin = (inputs: InputValues) => OutputValues;

type NodePins = Map<string, DebugPin>;

export class DebugProbe extends EventTarget {
  #inputPins = new Map<string, NodePins>();
  #nodePins = new Map<string, DebugNodePin>();

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
   * Add a debug pin to a node's input.
   *
   * Debug pin is a function that will be called before the
   * node's handler is called. If the pin function returns a value, that value
   * will be used as the input value. If the pin function returns undefined,
   * the input value will not be modified.
   *
   * @param nodeId - id of the node to add the pin to
   * @param inputName - name of the input to pin
   * @param debugPin - the pin function. It takes in the input value as its
   * only argument and returns a new value or undefined.
   */
  watchInput(nodeId: string, inputName: string, debugPin: DebugPin) {
    this.#getInputPins(nodeId).set(inputName, debugPin);
  }

  /**
   * Replacing a node's handler with a custom function.
   *
   * This can be useful when you want to avoid running a node's handler in
   * tests or other conditions. For example, replace a `generateText` node from
   * `llm-starter` kit with a function that returns a constant value.
   *
   * @param nodeId - id of the node whose handler to replace
   * @param pin - the new handler function. Unlike the handler function,
   * this one must be synchronous.
   */
  replaceNode(nodeId: string, pin: DebugNodePin) {
    this.#nodePins.set(nodeId, pin);
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
    const nodePin = this.#nodePins.get(descriptor.id);
    if (nodePin) {
      e.detail.outputs = nodePin(inputs);
      e.preventDefault();
    }
  }
}
