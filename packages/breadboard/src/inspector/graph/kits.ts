/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describerResultToNodeHandlerMetadata } from "../../graph-based-node-handler.js";
import { getGraphHandlerFromMutableGraph } from "../../handler.js";
import {
  GraphDescriptor,
  Kit,
  NodeConfiguration,
  NodeDescriberResult,
  NodeDescriberWires,
  NodeDescriptor,
  NodeHandler,
  NodeHandlerMetadata,
  NodeHandlerObject,
  NodeHandlers,
  NodeTypeIdentifier,
} from "../../types.js";
import { graphUrlLike } from "../../utils/graph-url-like.js";
import {
  InspectableKit,
  InspectableKitCache,
  InspectableNodePorts,
  InspectableNodeType,
  MainGraphIdentifier,
  MutableGraph,
  MutableGraphStore,
  NodeTypeDescriberOptions,
} from "../types.js";
import { collectPortsForType, filterSidePorts } from "./ports.js";
import { describeInput, describeOutput } from "./schemas.js";

export { KitCache, collectCustomNodeTypes, createBuiltInKit };

function unreachableCode() {
  return function () {
    throw new Error("This code should be never reached.");
  };
}

function createBuiltInKit(): Kit {
  return {
    title: "Built-in Kit",
    description: "A kit containing built-in Breadboard nodes",
    url: "",
    handlers: {
      input: {
        metadata: {
          title: "Input",
          description:
            "The input node. Use it to request inputs for your board.",
          help: {
            url: "https://breadboard-ai.github.io/breadboard/docs/reference/kits/built-in/#the-input-node",
          },
        },
        invoke: unreachableCode(),
      },
      output: {
        metadata: {
          title: "Output",
          description:
            "The output node. Use it to provide outputs from your board.",
          help: {
            url: "https://breadboard-ai.github.io/breadboard/docs/reference/kits/built-in/#the-output-node",
          },
        },
        invoke: unreachableCode(),
      },
      comment: {
        metadata: {
          description:
            "A comment node. Use this to put additional information on your board",
          title: "Comment",
          icon: "comment",
          tags: ["quick-access", "core"],
          order: 2,
        },
        invoke: unreachableCode(),
      },
    },
  };
}

const createBuiltInInspectableKit = (): InspectableKit => {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createCustomTypesKit = (
  nodes: NodeDescriptor[],
  mutable: MutableGraph
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
        return new CustomNodeType(type, mutable);
      }),
    },
  ];
};

export const collectKits = (
  mutable: MutableGraph,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  graph: GraphDescriptor
): InspectableKit[] => {
  const kits = mutable.store.kits;
  return [
    createBuiltInInspectableKit(),
    // TODO(dglazkov) Clean this up.
    // ...createCustomTypesKit(graph.nodes, mutable),
    ...kits.map((kit) => {
      const descriptor = {
        title: kit.title,
        description: kit.description,
        url: kit.url,
        tags: kit.tags || [],
      };
      return {
        descriptor,
        nodeTypes: collectNodeTypes(kit.handlers, mutable),
      };
    }),
  ];
};

function collectCustomNodeTypes(
  handlers: NodeHandlers,
  dependencies: MainGraphIdentifier[],
  store: MutableGraphStore
): InspectableNodeType[] {
  return Object.keys(handlers)
    .sort()
    .map((type) => {
      if (graphUrlLike(type)) {
        const mutable = store.addByURL(type, dependencies, {}).mutable;
        return new CustomNodeType(type, mutable);
      }
      throw new Error(`Unknown custom node type: ${type}`);
    });
}

export const createGraphNodeType = (
  type: NodeTypeIdentifier,
  mutable: MutableGraph
): InspectableNodeType => {
  return new CustomNodeType(type, mutable);
};

const collectNodeTypes = (
  handlers: NodeHandlers,
  mutable: MutableGraph
): InspectableNodeType[] => {
  return Object.entries(handlers)
    .sort()
    .map(([type, handler]) => {
      if (graphUrlLike(type)) {
        return new CustomNodeType(type, mutable);
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
      updating: false,
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
    return this.currentMetadata();
  }

  type() {
    return this.#type;
  }

  currentMetadata(): NodeHandlerMetadata {
    return "metadata" in this.#handler ? this.#handler.metadata || {} : {};
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
  updating: false,
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
  #mutable: MutableGraph;

  constructor(type: string, mutable: MutableGraph) {
    this.#type = type;
    this.#mutable = mutable;
    this.#handlerPromise = getGraphHandlerFromMutableGraph(type, mutable);
  }

  #extractExamples(
    describeResult: NodeDescriberResult
  ): NodeConfiguration | undefined {
    const example = describeResult.inputSchema.examples?.at(0);
    if (!example) return;
    try {
      return JSON.parse(example) as NodeConfiguration;
    } catch (e) {
      // eat the error.
    }
  }

  async #readMetadata() {
    const handler = await this.#handlerPromise;
    const describeResult = await handler?.describe?.(
      undefined,
      undefined,
      undefined,
      {
        graphStore: this.#mutable.store,
        outerGraph: this.#mutable.graph,
        kits: [...this.#mutable.store.kits],
        wires: {} as NodeDescriberWires,
        fileSystem: this.#mutable.store.fileSystem,
      }
    );
    if (
      describeResult &&
      describeResult.metadata &&
      Object.keys(describeResult.metadata).length > 0
    ) {
      const example = this.#extractExamples(describeResult);
      return {
        ...describeResult.metadata,
        example,
        title: describeResult.title,
        description: describeResult.description,
      };
    }
    if (handler && "metadata" in handler && handler.metadata) {
      return handler.metadata;
    }
    return {
      title: shortUrlTitle(this.#type),
    };
  }

  currentMetadata(): NodeHandlerMetadata {
    const { current, updating } = this.#mutable.describe.getByType(this.#type);
    const result = describerResultToNodeHandlerMetadata(current, updating);
    return result;
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
  #mutable: MutableGraph;

  constructor(mutable: MutableGraph) {
    this.#mutable = mutable;
  }

  getType(id: NodeTypeIdentifier): InspectableNodeType | undefined {
    return this.#types.get(id);
  }
  addType(id: NodeTypeIdentifier, type: InspectableNodeType): void {
    this.#types.set(id, type);
  }

  rebuild(graph: GraphDescriptor) {
    const kits = collectKits(this.#mutable, graph);

    this.#types = new Map(
      kits.flatMap((kit) => kit.nodeTypes.map((type) => [type.type(), type]))
    );
  }
}
