/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";

import type {
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescribeSnapshot,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import type { NodeDescriber } from "./node-describer.js";

export { NodeDescribeEntry, emptyResult };

function emptyResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

/**
 * A signal-backed entry for a single node's describe result.
 *
 * Lazily created and cached by `GraphController.describeNode()`.
 * Fetches the describe result via the injected `NodeDescriber` function.
 */
class NodeDescribeEntry {
  #current: Signal.State<NodeDescriberResult>;
  #updating: Signal.State<boolean> = new Signal.State(true);
  #latestPromise: Promise<NodeDescriberResult>;

  #describer: NodeDescriber;
  #type: NodeTypeIdentifier;
  #configuration: NodeConfiguration;

  constructor(
    describer: NodeDescriber,
    type: NodeTypeIdentifier,
    configuration: NodeConfiguration
  ) {
    this.#describer = describer;
    this.#type = type;
    this.#configuration = configuration;
    this.#current = new Signal.State(emptyResult());
    this.#latestPromise = this.#fetchLatest();
  }

  async #fetchLatest(): Promise<NodeDescriberResult> {
    this.#updating.set(true);
    try {
      const result = await this.#describer(this.#type, this.#configuration);
      this.#current.set(result);
      this.#updating.set(false);
      return result;
    } catch {
      this.#updating.set(false);
      return this.#current.get();
    }
  }

  /**
   * Re-fetch the describe result. Called when this node is in the
   * `affectedNodes` list of a graph change event.
   */
  refresh(configuration: NodeConfiguration) {
    this.#configuration = configuration;
    this.#latestPromise = this.#fetchLatest();
  }

  /** Returns a snapshot of the current describe state. */
  snapshot(): NodeDescribeSnapshot {
    return {
      current: this.#current.get(),
      latest: this.#latestPromise,
      updating: this.#updating.get(),
    };
  }
}
