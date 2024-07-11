/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  Kit,
  NodeHandler,
  NodeHandlerContext,
  NodeHandlerFunction,
} from "@google-labs/breadboard";
import type { GenericBoardDefinition } from "./board/board.js";
import { serialize } from "./board/serialize.js";
import {
  isDiscreteComponent,
  type GenericDiscreteComponent,
} from "./define/definition.js";

export interface KitOptions {
  title: string;
  description: string;
  version: string;
  url: string;
  components: Array<GenericDiscreteComponent | GenericBoardDefinition>;
}

export function kit(options: KitOptions): Kit {
  const handlers: Record<string, NodeHandler> = Object.fromEntries(
    options.components.map((component) => {
      if (isDiscreteComponent(component)) {
        return [component.id, component];
      } else {
        if (!component.id) {
          // TODO(aomarks) Make id required.
          throw new Error("To be added to a kit, boards must have an id.");
        }
        return [
          component.id,
          // TODO(aomarks) Should this just be the invoke() method on Board?
          makeBoardComponentHandler(component),
        ];
      }
    })
  );

  // TODO(aomarks) Unclear why this needs to be a class, and why it needs
  // certain fields on both the static and instance sides.
  return class GeneratedBreadboardKit {
    static handlers = handlers;
    static url = options.url;
    handlers = handlers;
    title = options.title;
    description = options.description;
    version = options.version;
    url = options.url;
  };
}

function makeBoardComponentHandler(board: GenericBoardDefinition): NodeHandler {
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
