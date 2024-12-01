/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  invokeGraph,
  type InputValues,
  type Kit,
  type KitConstructor,
  type NewNodeFactory,
  type NewNodeValue,
  type NodeDescriberResult,
  type NodeHandler,
  type NodeHandlerContext,
  type NodeHandlerObject,
} from "@google-labs/breadboard";
import type { GraphDescriptor, KitTag } from "@breadboard-ai/types";
import type { BoardDefinition } from "./board/board.js";
import { serialize } from "./board/serialize.js";
import type { Expand } from "./common/type-util.js";
import {
  isDiscreteComponent,
  type Definition,
  type GenericDiscreteComponent,
} from "./define/definition.js";

type ComponentManifest = Record<
  string,
  GenericDiscreteComponent | BoardDefinition | GraphDescriptor
>;

export interface KitOptions<T extends ComponentManifest = ComponentManifest> {
  title: string;
  description: string;
  version: string;
  url: string;
  tags?: KitTag[];
  components: T;
}

export type BuildKit<T extends ComponentManifest> = KitWithKnownHandlers<T> &
  KitConstructor<KitWithKnownHandlers<T>> &
  T & { legacy(): Promise<Expand<LegacyKit<T>>> };

type KitWithKnownHandlers<T extends ComponentManifest> = Kit & {
  handlers: { [K in keyof T]: NodeHandlerObject };
};

export async function kit<T extends ComponentManifest>(
  options: KitOptions<T>
): Promise<BuildKit<T>> {
  const handlers: Record<string, NodeHandler> = {};

  // TODO(aomarks) Unclear why this needs to be a class, and why it needs
  // certain fields on both the static and instance sides.
  const kit: KitConstructor<Kit> = class GeneratedBreadboardKit {
    static handlers = handlers;
    static url = options.url;
    handlers = handlers;
    title = options.title;
    description = options.description;
    version = options.version;
    url = options.url;
    tags = options.tags ?? [];
  };

  const kitBoundComponents = Object.fromEntries(
    Object.entries(options.components).map(([id, component]) => [
      id,
      isGraphDescriptor(component)
        ? component
        : bindComponentToKit(component, { kit, id }),
    ])
  );

  for (const [id, component] of Object.entries(kitBoundComponents)) {
    if (isDiscreteComponent(component)) {
      handlers[id] = component;
    } else if (isGraphDescriptor(component)) {
      handlers[id] = await makeGraphDescriptorComponentHandler(id, component);
    } else {
      handlers[id] = makeBoardComponentHandler(component, options.url);
    }
  }

  return Object.assign(kit, {
    ...kitBoundComponents,
  }) as BuildKit<T>;
}

function makeBoardComponentHandler(
  board: BoardDefinition,
  url: string
): NodeHandler {
  const serialized = serialize(board);
  return {
    metadata: {
      ...board.metadata,
      title: board.title ?? (board.metadata?.title as string | undefined),
      description:
        board.description ??
        (board.metadata?.description as string | undefined),
    },
    describe: board.describe.bind(board),
    async invoke(inputs: InputValues, context: NodeHandlerContext) {
      return invokeGraph({ graph: { ...serialized, url } }, inputs, context);
    },
  };
}

function emptyDescriberResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

async function makeGraphDescriptorComponentHandler(
  id: string,
  descriptor: GraphDescriptor
): Promise<NodeHandler> {
  return {
    metadata: {
      ...descriptor.metadata,
      title: descriptor.title,
      description: descriptor.description,
    },
    async describe(inputs, _inputSchema, _outputSchema, context) {
      const graphStore = context?.graphStore;
      if (!graphStore) {
        return emptyDescriberResult();
      }
      const adding = graphStore.addByDescriptor(descriptor);
      if (!adding.success) {
        return emptyDescriberResult();
      }
      const inspectableGraph = graphStore.inspect(adding.result, "");
      if (!inspectableGraph) {
        return emptyDescriberResult();
      }
      const result = await inspectableGraph.describe(inputs);
      return result;
    },
    async invoke(inputs: InputValues, context: NodeHandlerContext) {
      return invokeGraph({ graph: descriptor }, inputs, context);
    },
  };
}

/**
 * Describes the kit that a component is bound to, along with that component's
 * id within that kit.
 */
export interface KitBinding {
  id: string;
  kit: KitConstructor<Kit>;
}

/**
 * Returns a proxy of a component instance which binds it to a kit.
 */
function bindComponentToKit<
  T extends GenericDiscreteComponent | BoardDefinition,
>(definition: T, kitBinding: KitBinding): T {
  return new Proxy(definition, {
    apply(target, thisArg, args) {
      // The instantiate functions for both discrete and board components have
      // an optional final argument called `kitBinding`. Normally it is
      // undefined, but when called via this proxy we will add the final
      // argument. Now those instances know which kit they're from, which helps
      // us serialize them.
      //  eslint-disable-next-line @typescript-eslint/no-explicit-any
      return target.apply(thisArg, [...args, kitBinding] as any);
    },
  });
}

type LegacyKit<T extends ComponentManifest> = {
  [K in keyof T]: LegacyNodeSignature<T[K]>;
};

type LegacyNodeSignature<
  T extends GenericDiscreteComponent | BoardDefinition | GraphDescriptor,
> = T extends
  | BoardDefinition<infer I, infer O>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Definition<infer I, infer O, any, any, any, any, any, any, any>
  ? NewNodeFactory<
      Expand<Required<{ [K in keyof I]: NewNodeValue }>>,
      Expand<Required<{ [K in keyof O]: NewNodeValue }>>
    >
  : NewNodeFactory;

function isGraphDescriptor(value: unknown): value is GraphDescriptor {
  return (
    typeof value === "object" &&
    value !== null &&
    "nodes" in value &&
    "edges" in value
  );
}
