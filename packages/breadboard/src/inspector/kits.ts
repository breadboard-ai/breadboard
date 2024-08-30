/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGraphHandler } from "../handler.js";
import {
  NodeHandlers,
  NodeHandler,
  NodeDescriberResult,
  NodeHandlerMetadata,
  NodeDescriptor,
  NodeHandlerContext,
  NodeTypeIdentifier,
} from "../types.js";
import { graphUrlLike } from "../utils/graph-url-like.js";
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
      new BuiltInNodeType("input", describeInput, {
        title: "Input",
        description: "The input node. Use it to request inputs for your board.",
        help: {
          url: "https://breadboard-ai.github.io/breadboard/docs/reference/kits/built-in/#the-input-node",
        },
      }),
      new BuiltInNodeType("output", describeOutput, {
        title: "Output",
        description:
          "The output node. Use it to provide outputs from your board.",
        help: {
          url: "https://breadboard-ai.github.io/breadboard/docs/reference/kits/built-in/#the-output-node",
        },
      }),
    ],
  };
};

const createCustomTypesKit = (
  nodes: NodeDescriptor[],
  context: NodeHandlerContext
): InspectableKit[] => {
  const urlLikeNodeTypes = nodes
    .filter((node) => graphUrlLike(node.type))
    .map((node) => {
      return new CustomNodeType(node.type, context);
    });
  if (urlLikeNodeTypes.length === 0) {
    return [];
  }
  return [
    {
      descriptor: {
        title: "Custom Types",
        description: "Custom nodes found in the graph",
        url: "",
      },
      nodeTypes: urlLikeNodeTypes,
    },
  ];
};

export const collectKits = (
  context: NodeHandlerContext,
  nodes: NodeDescriptor[]
): InspectableKit[] => {
  const { kits = [] } = context;
  return [
    createBuiltInKit(),
    ...createCustomTypesKit(nodes, context),
    ...kits.map((kit) => {
      const descriptor = {
        title: kit.title,
        description: kit.description,
        url: kit.url,
        tags: kit.tags || [],
      };
      return {
        descriptor,
        nodeTypes: collectNodeTypes(kit.handlers),
      };
    }),
  ];
};

export const createGraphNodeType = (
  type: NodeTypeIdentifier,
  context: NodeHandlerContext
): InspectableNodeType => {
  return new CustomNodeType(type, context);
};

const collectNodeTypes = (handlers: NodeHandlers): InspectableNodeType[] => {
  return Object.entries(handlers)
    .sort()
    .map(([type, handler]) => new KitNodeType(type, handler));
};

const portsFromHandler = async (
  type: NodeTypeIdentifier,
  handler: NodeHandler | undefined
): Promise<InspectableNodePorts> => {
  if (!handler || typeof handler === "function" || !handler.describe) {
    return emptyPorts();
  }
  try {
    const described = await handler.describe();
    return {
      inputs: {
        fixed: described.inputSchema.additionalProperties === false,
        ports: collectPortsForType(described.inputSchema, "input"),
      },
      outputs: {
        fixed: described.outputSchema.additionalProperties === false,
        ports: collectPortsForType(described.outputSchema, "output"),
      },
    };
  } catch (e) {
    console.warn(`Error describing node type ${type}:`, e);
    return emptyPorts();
  }
};

class KitNodeType implements InspectableNodeType {
  #type: string;
  #handler: NodeHandler;

  constructor(type: string, handler: NodeHandler) {
    this.#type = type;
    this.#handler = handler;
  }

  metadata(): NodeHandlerMetadata {
    return "metadata" in this.#handler ? this.#handler.metadata || {} : {};
  }

  type() {
    return this.#type;
  }

  async ports(): Promise<InspectableNodePorts> {
    return portsFromHandler(this.#type, this.#handler);
  }
}

class BuiltInNodeType extends KitNodeType {
  constructor(
    type: string,
    describer: (options: NodeTypeDescriberOptions) => NodeDescriberResult,
    metadata: NodeHandlerMetadata
  ) {
    super(type, {
      invoke: async () => {},
      describe: async () => {
        return describer({});
      },
      metadata,
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

function shortUrlTitle(url: string) {
  const urlObj = new URL(url);
  const path = urlObj.pathname.split("/").pop();
  return path || urlObj.host;
}

class CustomNodeType implements InspectableNodeType {
  #type: string;
  #context: NodeHandlerContext;
  #metadata: NodeHandlerMetadata;
  #handlerPromise: Promise<NodeHandler | undefined>;

  constructor(type: string, context: NodeHandlerContext) {
    this.#type = type;
    this.#context = context;
    this.#metadata = {
      title: shortUrlTitle(type),
    };
    this.#handlerPromise = this.#update();
  }

  async #update(): Promise<NodeHandler | undefined> {
    const handler = await getGraphHandler(this.#type, this.#context);
    if (handler && "metadata" in handler && handler.metadata) {
      // this.#metadata = handler.metadata;
    }
    return handler;
  }

  metadata(): NodeHandlerMetadata {
    return this.#metadata;
  }

  type() {
    return this.#type;
  }

  async ports(): Promise<InspectableNodePorts> {
    const handler = await this.#handlerPromise;
    return portsFromHandler(this.#type, handler);
  }
}
