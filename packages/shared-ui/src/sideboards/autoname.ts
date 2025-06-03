/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditableGraph, err, ok, Outcome } from "@google-labs/breadboard";
import { SideBoardRuntime } from "./types";

import AutonameSideboard from "./sideboards-bgl/autoname.bgl.json" with { type: "json" };
import {
  GraphIdentifier,
  JsonSerializable,
  LLMContent,
  NodeConfiguration,
  NodeIdentifier,
} from "@breadboard-ai/types";

export { Autoname };

export type NodeConfigurationUpdate = {
  nodeConfigurationUpdate: {
    type: string;
    configuration: NodeConfiguration;
  };
};

export type AutonameArguments = NodeConfigurationUpdate;

export type NotEnoughContextResult = {
  notEnoughContext: true;
};

export type NodeConfigurationUpdateResult = {
  title: string;
  description: string;
};

export type AutonameStatus = "running" | "idle";

export type AutonameResult =
  | NotEnoughContextResult
  | NodeConfigurationUpdateResult;

export type AutonameCallbacks = {
  statuschange: (status: AutonameStatus) => void;
};

class Autoname {
  #pending: Set<object> = new Set();
  #status: AutonameStatus = "idle";

  /**
   *
   * @param runtime
   * @param allGraphs - if true, all graphs will be autonamed. Otherwise, only
   * subgraphs will be autonamed.
   */
  constructor(
    public readonly runtime: SideBoardRuntime,
    private readonly callbacks: AutonameCallbacks
  ) {}

  async onNodeConfigurationUpdate(
    editor: EditableGraph,
    id: NodeIdentifier,
    graphId: GraphIdentifier,
    configuration: NodeConfiguration
  ): Promise<Outcome<AutonameResult>> {
    const inspector = editor.inspect(graphId);
    const node = inspector.nodeById(id);
    if (!node) {
      const msg = `Unable to find node with id: "${id}"`;
      console.error(msg);
      return err(msg);
    }
    const type = node.descriptor.type;

    const abortController = new AbortController();
    let graphChanged = false;
    editor.addEventListener(
      "graphchange",
      () => {
        graphChanged = true;
        abortController.abort();
      },
      { once: true }
    );

    const o = {};
    this.#pending.add(o);
    const oldStatus = this.#status;
    this.#status = "running";
    if (oldStatus !== this.#status) {
      this.callbacks.statuschange(this.#status);
    }

    const outputs = await this.runtime.runTask({
      graph: AutonameSideboard,
      context: asLLMContent({
        nodeConfigurationUpdate: { configuration, type },
      } satisfies AutonameArguments),
      url: editor.raw().url,
      signal: abortController.signal,
    });
    this.#pending.delete(o);
    if (this.#pending.size === 0) {
      this.#status = "idle";
      this.callbacks.statuschange(this.#status);
    }

    if (graphChanged) {
      // Graph changed in the middle of a task, throw away the results.
      const msg = "Results discarded due to graph change";
      console.log(msg);
      return err(msg);
    }
    if (!ok(outputs)) {
      console.error(outputs.$error);
      return outputs;
    }
    const part = outputs.at(0)?.parts.at(0);
    if (!(part && "json" in part)) {
      return err(`Invalid sideboard output`);
    }
    const result = part.json as AutonameResult;
    console.log("AUTONAMING RESULT", result);
    return result;
  }
}

function asLLMContent<T>(o: T): LLMContent[] {
  return [{ parts: [{ json: o as JsonSerializable }] }];
}
