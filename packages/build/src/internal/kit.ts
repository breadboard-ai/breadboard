/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  addKit,
  Board,
  inspect,
  type BreadboardNode,
  type ConfigOrGraph,
  type InputValues,
  type Kit,
  type KitConstructor,
  type NewNodeFactory,
  type NewNodeValue,
  type NodeHandler,
  type NodeHandlerContext,
  type NodeHandlerFunction,
  type NodeHandlerObject,
  type NodeHandlers,
} from "@google-labs/breadboard";
import type { GraphDescriptor, KitTag, SubGraphs } from "@breadboard-ai/types";
import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";
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
      handlers[id] = makeBoardComponentHandler(component);
    }
  }

  return Object.assign(kit, {
    ...kitBoundComponents,
    legacy: () => makeLegacyKit<T>(options),
  }) as BuildKit<T>;
}

function makeBoardComponentHandler(board: BoardDefinition): NodeHandler {
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
      // Assume that invoke is available, since that's part of core kit, and use
      // that to execute our serialized board.
      const invoke = findInvokeFunctionFromContext(context);
      if (invoke === undefined) {
        return {
          $error:
            `Could not find an "invoke" node in the given context while ` +
            `trying to execute the board with id "${board.id}" as component.`,
        };
      }
      return invoke({ ...inputs, $board: serialized }, context);
    },
  };
}

async function makeGraphDescriptorComponentHandler(
  id: string,
  descriptor: GraphDescriptor
): Promise<NodeHandler> {
  const description = await inspect(descriptor).describe();
  return {
    metadata: {
      ...descriptor.metadata,
      title: descriptor.title,
      description: descriptor.description,
    },
    describe: () => Promise.resolve(description),
    async invoke(inputs: InputValues, context: NodeHandlerContext) {
      // Assume that invoke is available, since that's part of core kit, and use
      // that to execute our serialized board.
      const invoke = findInvokeFunctionFromContext(context);
      if (invoke === undefined) {
        return {
          $error:
            `Could not find an "invoke" node in the given context while ` +
            `trying to execute the board with id "${id}" as component.`,
        };
      }
      return invoke({ ...inputs, $board: descriptor }, context);
    },
  };
}

function findInvokeFunctionFromContext(
  context: NodeHandlerContext
): NodeHandlerFunction | undefined {
  for (const kit of context.kits ?? []) {
    const invoke = kit.handlers["invoke"];
    if (invoke !== undefined) {
      return "invoke" in invoke ? invoke.invoke : invoke;
    }
  }
  return undefined;
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

/**
 * We also expose a "legacy" property, an async function which returns a version
 * of this Kit that can be used directly in the old API.
 */
async function makeLegacyKit<T extends ComponentManifest>({
  title,
  description,
  version,
  url,
  components,
}: KitOptions): Promise<Expand<LegacyKit<T>>> {
  const kitBoard = new Board({ title, description, version });
  const { Core } = await import(
    // Cast to prevent TypeScript from trying to import these types (we don't
    // want to depend on them in the type system because it's a circular
    // dependency).
    "@google-labs/core-kit" as string
  );
  const core = kitBoard.addKit(Core) as object as {
    invoke: (config?: ConfigOrGraph) => BreadboardNode<unknown, unknown>;
  };
  const handlers: NodeHandlers = {};
  const adapter = await GraphToKitAdapter.create(kitBoard, url, []);
  const graphs: SubGraphs = {};
  for (const [id, component] of Object.entries(components)) {
    if (isDiscreteComponent(component)) {
      handlers[id] = component;
    } else {
      core.invoke({
        $id: id,
        $board: `#${id}`,
        $metadata: {
          ...component.metadata,
          title: component.title ?? component.metadata?.title,
          description: component.description ?? component.metadata?.description,
        },
      });
      graphs[id] = isGraphDescriptor(component)
        ? component
        : serialize(component);
      handlers[id] = adapter.handlerForNode(id);
    }
  }
  kitBoard.graphs = graphs;
  const builder = new KitBuilder(adapter.populateDescriptor({ url }));
  return addKit(builder.build(handlers)) as object as Promise<
    Expand<LegacyKit<T>>
  >;
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
