/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  NodeMetadata,
  OutputValues,
  Probe,
} from "@breadboard-ai/types";

export { Telemetry };

type Context = {
  probe?: Probe;
  invocationPath?: number[];
};

class Telemetry {
  index = 0;

  static create(context: Context) {
    if (context.probe && context.invocationPath) {
      return new Telemetry(context.probe, context.invocationPath);
    }
    return undefined;
  }

  constructor(
    public readonly probe: Probe,
    public readonly path: number[]
  ) {}

  async startModule() {
    await this.probe.report?.({
      type: "graphstart",
      data: {
        graph: virtualGraph(),
        graphId: "",
        path: this.path,
        timestamp: timestamp(),
      },
    });
  }

  async startCapability(
    type: string,
    inputs: InputValues,
    metadata?: NodeMetadata
  ): Promise<number> {
    const path = ++this.index;
    await this.probe.report?.({
      type: "nodestart",
      data: {
        node: this.#getDescriptor(type, metadata),
        inputs,
        path: this.invocationPath(path),
        timestamp: timestamp(),
      },
    });
    return path;
  }

  async endCapability(
    type: string,
    path: number,
    inputs: InputValues,
    outputs: OutputValues
  ) {
    await this.probe.report?.({
      type: "nodeend",
      data: {
        node: this.#getDescriptor(type),
        inputs,
        outputs,
        path: this.invocationPath(path),
        timestamp: timestamp(),
        newOpportunities: [],
      },
    });
  }

  async endModule() {
    await this.probe.report?.({
      type: "graphend",
      data: {
        path: this.path,
        timestamp: timestamp(),
      },
    });
  }

  invocationPath(path: number) {
    return [...this.path, path];
  }

  #getDescriptor(type: string, metadata?: NodeMetadata) {
    return {
      id: `${type}-${this.index}`,
      type,
      metadata,
    };
  }
}

function virtualGraph(): GraphDescriptor {
  return {
    nodes: [],
    edges: [],
    virtual: true,
  };
}

function timestamp() {
  return globalThis.performance.now();
}
