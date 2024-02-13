/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitDescriptor, Kit, NodeHandlers, NodeHandler } from "../types.js";
import { collectPortsForType } from "./ports.js";
import {
  InspectableKit,
  InspectableNodePorts,
  InspectableNodeType,
} from "./types.js";

export const collectKits = (kits: Kit[]): InspectableKit[] => {
  return kits.map((kit) => ({
    descriptor: kit as KitDescriptor,
    nodeTypes: collectNodeTypes(kit.handlers),
  }));
};

const collectNodeTypes = (handlers: NodeHandlers): InspectableNodeType[] => {
  return Object.entries(handlers).map(
    ([type, handler]) => new NodeType(type, handler)
  );
};

class NodeType implements InspectableNodeType {
  #type: string;
  #handler: NodeHandler;

  constructor(type: string, handler: NodeHandler) {
    this.#type = type;
    this.#handler = handler;
  }

  type() {
    return this.#type;
  }

  async ports(): Promise<InspectableNodePorts> {
    if (typeof this.#handler === "function" || !this.#handler.describe) {
      return emptyPorts();
    }
    try {
      const described = await this.#handler.describe();
      return {
        inputs: {
          fixed: described.inputSchema.additionalProperties === false,
          ports: collectPortsForType(described.inputSchema),
        },
        outputs: {
          fixed: described.outputSchema.additionalProperties === false,
          ports: collectPortsForType(described.outputSchema),
        },
      };
    } catch (e) {
      console.warn(`Error describing node type ${this.#type}:`, e);
      return emptyPorts();
    }
  }
}

export const emptyPorts = (): InspectableNodePorts => ({
  inputs: {
    ports: [],
    fixed: false,
  },
  outputs: {
    ports: [],
    fixed: false,
  },
});
