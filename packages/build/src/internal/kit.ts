/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  addKit,
  Board,
  type BreadboardNode,
  type ConfigOrGraph,
  type InputValues,
  type Kit,
  type KitConstructor,
  type NewNodeFactory,
  type NodeHandler,
  type NodeHandlerContext,
  type NodeHandlerFunction,
  type NodeHandlers,
  type NewNodeValue,
} from "@google-labs/breadboard";
import type {
  KitTag,
  SubGraphs,
} from "@google-labs/breadboard-schema/graph.js";
import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";
import type { BoardDefinition } from "./board/board.js";
import { serialize } from "./board/serialize.js";
import {
  isDiscreteComponent,
  type Definition,
  type GenericDiscreteComponent,
} from "./define/definition.js";

type ComponentManifest = Record<
  string,
  GenericDiscreteComponent | BoardDefinition
>;

export interface KitOptions<T extends ComponentManifest = ComponentManifest> {
  title: string;
  description: string;
  version: string;
  url: string;
  tags?: KitTag[];
  components: T;
}

export function kit<T extends ComponentManifest>(
  options: KitOptions<T>
): KitConstructor<Kit> & T & { legacy(): Promise<LegacyKit<T>> } {
  const componentsWithIds = Object.fromEntries(
    Object.entries(options.components).map(([id, component]) => [
      id,
      bindComponentToKit(component, id),
    ])
  );
  const handlers: Record<string, NodeHandler> = Object.fromEntries(
    Object.values(componentsWithIds).map((component) => {
      if (isDiscreteComponent(component)) {
        return [component.id, component];
      } else {
        return [
          component.id,
          // TODO(aomarks) Should this just be the invoke() method on Board?
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          makeBoardComponentHandler(component as any),
        ];
      }
    })
  );

  // TODO(aomarks) Unclear why this needs to be a class, and why it needs
  // certain fields on both the static and instance sides.
  const result = class GeneratedBreadboardKit {
    static handlers = handlers;
    static url = options.url;
    handlers = handlers;
    title = options.title;
    description = options.description;
    version = options.version;
    url = options.url;
    tags = options.tags ?? [];
  };
  return Object.assign(result, {
    ...componentsWithIds,
    legacy: () => makeLegacyKit<T>(options),
  }) as KitConstructor<Kit> as KitConstructor<Kit> &
    T & { legacy: () => Promise<LegacyKit<T>> };
}

function makeBoardComponentHandler(board: BoardDefinition): NodeHandler {
  const serialized = serialize(board);
  return {
    metadata: board.metadata,
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
 * Components don't have ids until they are added to a kit. This function
 * returns a proxy of the component that adds an "id" property.
 */
function bindComponentToKit<
  T extends GenericDiscreteComponent | BoardDefinition,
>(component: T, id: string): T & { id: string } {
  return new Proxy(component, {
    get(target, prop) {
      return prop === "id"
        ? id
        : (target as object as Record<string | symbol, unknown>)[prop];
    },
  }) as T & { id: string };
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
}: KitOptions): Promise<LegacyKit<T>> {
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
          title: component.title,
          description: component.description,
          ...component.metadata,
        },
      });
      graphs[id] = serialize(component);
      handlers[id] = adapter.handlerForNode(id);
    }
  }
  kitBoard.graphs = graphs;
  const builder = new KitBuilder(adapter.populateDescriptor({ url }));
  return addKit(builder.build(handlers)) as object as Promise<LegacyKit<T>>;
}

type LegacyKit<T extends ComponentManifest> = {
  [K in keyof T]: LegacyNodeSignature<T[K]>;
};

type LegacyNodeSignature<T extends GenericDiscreteComponent | BoardDefinition> =
  T extends
    | BoardDefinition<infer I, infer O>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Definition<infer I, infer O, any, any, any, any, any, any, any>
    ? NewNodeFactory<
        { [K in keyof I]: NewNodeValue },
        { [K in keyof O]: NewNodeValue }
      >
    : never;
