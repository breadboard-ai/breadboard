/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardNode,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
  KitConstructor,
  Board,
} from "@google-labs/breadboard";
import { InputValues, NodeHandlers } from "@google-labs/graph-runner";

type Key = string | symbol | number;

export type GenericKit<T extends readonly Key[]> = Kit & {
  [key in T[number]]: <In = unknown, Out = unknown>(
    config?: OptionalIdConfiguration
  ) => BreadboardNode<In, Out>;
};

export const makeKit = <T extends readonly Key[]>(
  handlers: NodeHandlers,
  nodes: T,
  url: string,
  prefix: string
) => {
  return class implements Kit {
    url = url;

    get handlers() {
      return handlers;
    }

    constructor(nodeFactory: NodeFactory) {
      return new Proxy(this, {
        get(target, prop: string) {
          if (prop === "handlers" || prop === "url") {
            return target[prop];
          } else if (nodes.includes(prop as T[number])) {
            return (config: OptionalIdConfiguration = {}) => {
              const { $id, ...rest } = config;
              return nodeFactory.create(`${prefix}${prop}`, { ...rest }, $id);
            };
          }
        },
      });
    }
  } as KitConstructor<GenericKit<T>>;
};

export const makeHandlersFromUrls = async (
  nodes: readonly string[],
  baseUrl: string,
  nodePrefix: string
) => {
  const boards = nodes.map((node) => `${nodePrefix}${node}`);

  const boardHandlers = await Promise.all(
    boards
      .map((board) => `${baseUrl}${board}.json`)
      .map(async (url: string) => {
        return async (inputs: InputValues) => {
          const board = await Board.load(url);
          return await board.runOnce(inputs);
        };
      })
  );

  return boards.reduce((acc, board, index) => {
    acc[board] = boardHandlers[index];
    return acc;
  }, {} as NodeHandlers);
};
