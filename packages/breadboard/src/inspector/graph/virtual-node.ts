/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeConfiguration,
  NodeDescriptor,
  NodeMetadata,
} from "@breadboard-ai/types";
import type { NodeDescriberResult } from "../../types.js";
import type {
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
  InspectableNodeType,
} from "../types.js";
import { describerResultToPorts } from "./ports.js";
import { describeOutput } from "./schemas.js";

export { VirtualNode };

type VirtualNodeType = "fetch" | "secrets" | "invoke" | "output" | "unknown";

function discernType(id: string): VirtualNodeType {
  const [type] = id.split("-");
  if (["fetch", "secrets", "invoke", "output"].includes(type)) {
    return type as VirtualNodeType;
  }
  return "unknown";
}

/**
 * A virtual node represents a node in a virtual graph. Virtual
 * Graphs aren't actually graphs, but rather code that
 * behaves as in a "graph-like" way: it may invoke components,
 * but its topology is entirely imperative.
 * For example, the runModule code is a virtual graph, and
 * every capability it invokes shows up as a virtual node.
 */
class VirtualNode implements InspectableNode {
  #id: string;
  // Currently matches runModule capabilities.
  #type: VirtualNodeType;
  descriptor: NodeDescriptor;

  constructor(descriptor: Partial<NodeDescriptor>) {
    const { id = "", type, metadata } = descriptor;
    this.#id = id;
    this.#type = (type as VirtualNodeType) || discernType(id);
    this.descriptor = {
      id,
      type: this.#type,
      metadata,
      configuration: descriptor.configuration,
    };
  }

  title(): string {
    return this.descriptor.metadata?.title || this.#type;
  }

  description(): string {
    return this.descriptor.metadata?.description || this.title();
  }

  incoming(): InspectableEdge[] {
    return [];
  }

  outgoing(): InspectableEdge[] {
    return [];
  }

  isEntry(): boolean {
    return false;
  }

  isExit(): boolean {
    return false;
  }

  #ports(inputs: InputValues): InspectableNodePorts {
    const { type, configuration } = this.descriptor;
    if (type === "output") {
      return describerResultToPorts(
        this,
        describeOutput({
          inputs: { ...configuration, ...inputs },
        }),
        inputs
      );
    }
    return {
      inputs: {
        ports: [],
        fixed: true,
      },
      outputs: {
        ports: [],
        fixed: true,
      },
      side: {
        ports: [],
        fixed: true,
      },
    };
  }

  type(): InspectableNodeType {
    return {
      metadata: async () => {
        return {
          title: this.#type,
        };
      },
      currentMetadata: () => {
        return {
          title: this.#type,
        };
      },
      type: () => {
        return this.#type;
      },
      ports: async () => {
        return this.#ports({});
      },
    };
  }

  async describe(): Promise<NodeDescriberResult> {
    return {
      inputSchema: {},
      outputSchema: {},
    };
  }

  configuration(): NodeConfiguration {
    return this.descriptor.configuration || {};
  }

  metadata(): NodeMetadata {
    return this.descriptor.metadata || {};
  }

  async ports(inputs: InputValues): Promise<InspectableNodePorts> {
    return this.#ports(inputs);
  }

  currentPorts(inputs: InputValues): InspectableNodePorts {
    return this.#ports(inputs);
  }

  deleted(): boolean {
    return false;
  }
}
