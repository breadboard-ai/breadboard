/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Kit,
  NodeHandlers,
  NodeHandler,
  NodeDescriberResult,
} from "../types.js";
import { collectPortsForType } from "./ports.js";
import { describeInput, describeOutput } from "./schemas.js";
import {
  InspectableKit,
  InspectableNodePorts,
  InspectableNodeType,
  NodeTypeDescriberOptions,
} from "./types.js";

const createBuiltInKit = (): InspectableKit => {
  return {
    descriptor: {
      title: "Built-in Kit",
      description: "A kit containing built-in Breadboard nodes",
      url: "",
    },
    nodeTypes: [
      new BuiltInNodeType("input", describeInput),
      new BuiltInNodeType("output", describeOutput),
    ],
  };
};

export const collectKits = (kits: Kit[]): InspectableKit[] => {
  return [
    createBuiltInKit(),
    ...kits.map((kit) => {
      const descriptor = {
        title: kit.title,
        description: kit.description,
        url: kit.url,
      };
      return {
        descriptor,
        nodeTypes: collectNodeTypes(kit.handlers),
      };
    }),
  ];
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

class BuiltInNodeType extends NodeType {
  constructor(
    type: string,
    describer: (options: NodeTypeDescriberOptions) => NodeDescriberResult
  ) {
    super(type, {
      invoke: async () => {},
      describe: async () => {
        return describer({});
      },
    });
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
