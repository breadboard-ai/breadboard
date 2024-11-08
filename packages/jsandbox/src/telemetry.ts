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

class Telemetry {
  index = 0;

  static create(probe?: Probe, path?: number[]): Telemetry | undefined {
    return probe && path ? new Telemetry(probe, path) : undefined;
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
        path: this.path,
        timestamp: timestamp(),
      },
    });
  }

  async startCapability(
    type: string,
    inputs: InputValues,
    metadata?: NodeMetadata
  ) {
    ++this.index;
    await this.probe.report?.({
      type: "nodestart",
      data: {
        node: this.#getDescriptor(type, metadata),
        inputs,
        path: [...this.path, this.index],
        timestamp: timestamp(),
      },
    });
  }

  async endCapability(
    type: string,
    inputs: InputValues,
    outputs: OutputValues
  ) {
    await this.probe.report?.({
      type: "nodeend",
      data: {
        node: this.#getDescriptor(type),
        inputs,
        outputs,
        path: [...this.path, this.index],
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
