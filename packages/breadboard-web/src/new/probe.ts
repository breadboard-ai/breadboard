/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardValidatorMetadata,
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "../../../breadboard/dist/src/types";

/**
 * Details of the `ProbeEvent` event.
 */
export interface ProbeDetails {
  /**
   * Internal representation of the node that is placed on the board.
   */
  descriptor: NodeDescriptor;
  /**
   * The input values the node was passed.
   */
  inputs: InputValues;
  /**
   * Any missing inputs that the node was expecting.
   * This property is only populated for `skip` event.
   */
  missingInputs?: string[];
  /**
   * The output values the node provided.
   */
  outputs?: OutputValues | Promise<OutputValues>;
  /**
   * The nesting level of the node.
   * When a board contains included or slotted boards, this level will
   * increment for each level of nesting.
   */
  nesting?: number;
  /*
   * Invocation Path. This is an array of unique node invocation ids that
   * represents the current place of the node in the graph traversal.
   * It can be used to correlate events.
   * The array is unique to the invocation of a node across all board runs.
   */
  path: number[];
  sources?: string[];
  validatorMetadata?: BreadboardValidatorMetadata[];
}

export class ProbeEvent extends CustomEvent<ProbeDetails> {
  constructor(type: string, detail: ProbeDetails) {
    super(type, { detail, cancelable: true });
  }
}

export type Receiver = {
  log: (...args: unknown[]) => void;
};

/**
 * A convenience probe for easily logging events from the Board.
 * Usage:
 * ```ts
 * const log = new LogProbe();
 * for await (const result of this.run(log)) {
 *  // ...
 * }
 * ```
 */
export class LogProbe extends EventTarget {
  #receiver: Receiver;

  /**
   * Creates a new LogProbe instance. If no receiver is provided, the
   * console will be used.
   * @param receiver Optional. An object with a `log` method that accepts
   * any number of arguments.
   */
  constructor(receiver?: Receiver) {
    super();
    this.#receiver = receiver || console;
    const eventHandler = this.#eventHandler.bind(this);
    this.addEventListener("input", eventHandler);
    this.addEventListener("skip", eventHandler);
    this.addEventListener("node", eventHandler);
    this.addEventListener("output", eventHandler);
  }

  #eventHandler = (event: Event) => {
    const e = event as ProbeEvent;
    this.#receiver.log(e.type, e.detail);
  };
}
