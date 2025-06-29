/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InspectableKit,
  InspectableKitCache,
  InspectableNodePorts,
  InspectableNodeType,
  Kit,
  MutableGraph,
  NodeDescriberResult,
  NodeHandler,
  NodeHandlerMetadata,
  NodeHandlers,
  NodeTypeDescriberOptions,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { graphUrlLike } from "@breadboard-ai/utils";
import { GraphNodeType } from "./graph-node-type.js";
import { portsFromHandler } from "./ports.js";
import { describeInput, describeOutput } from "./schemas.js";

export { createBuiltInKit, KitCache };

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

const collectNodeTypes = (
  handlers: NodeHandlers,
  mutable: MutableGraph
): InspectableNodeType[] => {
  return Object.entries(handlers)
    .sort()
    .map(([type, handler]) => {
      if (graphUrlLike(type)) {
        return new GraphNodeType(type, mutable);
      }
      return new KitNodeType(type, handler);
    });
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
