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
  NodeHandlerObject,
  GraphDescriptor,
} from "../types.js";
import { graphUrlLike } from "../utils/graph-url-like.js";
import { collectPortsForType, filterSidePorts } from "./ports.js";
import { describeInput, describeOutput } from "./schemas.js";
import {
  InspectableGraphOptions,
  InspectableKit,
  InspectableKitCache,
  InspectableNodePorts,
  InspectableNodeType,
  NodeTypeDescriberOptions,
} from "./types.js";

export { KitCache };

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
  const urlLikeNodeTypes = nodes.filter((node) => graphUrlLike(node.type));

  const uniqueTypes = [...new Set(urlLikeNodeTypes.map((node) => node.type))];
  if (uniqueTypes.length === 0) {
    return [];
  }
  return [
    {
      descriptor: {
        title: "Custom Types",
        description: "Custom nodes found in the graph",
        url: "",
      },
      nodeTypes: uniqueTypes.map((type) => {
        return new CustomNodeType(type, context);
      }),
    },
  ];
};

export const collectKits = (
  context: NodeHandlerContext,
  graph: GraphDescriptor
): InspectableKit[] => {
  const { kits = [] } = context;
  return [
    createBuiltInKit(),
    ...createCustomTypesKit(graph.nodes, context),
    ...kits.map((kit) => {
      const descriptor = {
        title: kit.title,
        description: kit.description,
        url: kit.url,
        tags: kit.tags || [],
      };
      return {
        descriptor,
        nodeTypes: collectNodeTypes(kit.handlers, context),
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

const collectNodeTypes = (
  handlers: NodeHandlers,
  context: NodeHandlerContext
): InspectableNodeType[] => {
  return Object.entries(handlers)
    .sort()
    .map(([type, handler]) => {
      if (graphUrlLike(type)) {
        return new CustomNodeType(type, context);
      }
      return new KitNodeType(type, handler);
    });
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
    const inputs = {
      fixed: described.inputSchema.additionalProperties === false,
      ports: collectPortsForType(described.inputSchema, "input"),
    };
    const side = {
      fixed: true,
      ports: filterSidePorts(inputs),
    };
    return {
      inputs,
      outputs: {
        fixed: described.outputSchema.additionalProperties === false,
        ports: collectPortsForType(described.outputSchema, "output"),
      },
      side,
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

  async metadata(): Promise<NodeHandlerMetadata> {
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
  side: {
    ports: [],
    fixed: true,
  },
});

function shortUrlTitle(url: string) {
  const urlObj = new URL(url);
  const path = urlObj.pathname.split("/").pop();
  return path || urlObj.host;
}

class CustomNodeType implements InspectableNodeType {
  #type: string;
  #metadata: NodeHandlerMetadata | null = null;
  #handlerPromise: Promise<NodeHandlerObject | undefined> | null = null;

  constructor(type: string, context: NodeHandlerContext) {
    this.#type = type;
    this.#handlerPromise = getGraphHandler(type, context);
  }

  async #readMetadata() {
    const handler = await this.#handlerPromise;
    if (handler && "metadata" in handler && handler.metadata) {
      return handler.metadata;
    }
    return {
      title: shortUrlTitle(this.#type),
    };
  }

  async metadata(): Promise<NodeHandlerMetadata> {
    this.#metadata ??= await this.#readMetadata();
    return this.#metadata;
  }

  type() {
    return this.#type;
  }

  async ports(): Promise<InspectableNodePorts> {
    const handler = await this.#handlerPromise;
    return portsFromHandler(this.#type, handler as NodeHandler);
  }
}

class KitCache implements InspectableKitCache {
  #types: Map<NodeTypeIdentifier, InspectableNodeType> = new Map();
  #kits: InspectableKit[] = [];
  #options: InspectableGraphOptions;

  constructor(options: InspectableGraphOptions) {
    this.#options = options;
  }

  getType(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    return this.#types.get(id);
  }
  addType(id: NodeTypeIdentifier, type: InspectableNodeType): void {
    this.#types.set(id, type);
  }

  kits(): InspectableKit[] {
    return this.#kits;
  }

  rebuild(graph: GraphDescriptor) {
    const kits = collectKits(this.#options, graph);

    this.#types = new Map(
      kits.flatMap((kit) => kit.nodeTypes.map((type) => [type.type(), type]))
    );
    this.#kits = kits;
  }
}
