/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseURLFromContext } from "./loader/loader.js";
import {
  BreadboardCapability,
  GraphDescriptor,
  GraphDescriptorBoardCapability,
  NodeHandlerContext,
  NodeValue,
  OutputValues,
  ResolvedURLBoardCapability,
  UnresolvedPathBoardCapability,
} from "./types.js";

// Helpers for BreadboardCapability

export const isBreadboardCapability = (
  o: unknown
): o is BreadboardCapability => {
  const maybe = o as BreadboardCapability;
  return !!maybe && maybe.kind === "board";
};

export const isGraphDescriptorCapability = (
  capability: BreadboardCapability
): capability is GraphDescriptorBoardCapability => {
  const maybe = capability as GraphDescriptorBoardCapability;
  const board = maybe.board;
  return !!board && !!board.edges && !!board.nodes;
};

export const isResolvedURLBoardCapability = (
  capability: BreadboardCapability
): capability is ResolvedURLBoardCapability => {
  const maybe = capability as ResolvedURLBoardCapability;
  const url = maybe.url;
  return !!url;
};

export const isUnresolvedPathBoardCapability = (
  capability: BreadboardCapability
): capability is UnresolvedPathBoardCapability => {
  const maybe = capability as UnresolvedPathBoardCapability;
  const path = maybe.path;
  return !!path;
};

const isGraphDescriptor = (
  candidate: unknown
): candidate is GraphDescriptor => {
  const graph = candidate as GraphDescriptor;
  return (
    graph && typeof graph === "object" && graph.nodes && graph.edges && true
  );
};

export const graphDescriptorFromCapability = async (
  capability: BreadboardCapability,
  context?: NodeHandlerContext
) => {
  if (isGraphDescriptorCapability(capability)) {
    // If all we got is a GraphDescriptor, build a runnable board from it.
    // TODO: Use JSON schema to validate rather than this hack.
    return capability.board;
  } else if (isResolvedURLBoardCapability(capability)) {
    if (!context?.loader) {
      throw new Error(
        `The "board" Capability is a URL, but no loader was supplied.`
      );
    }
    const loaderResult = await context.loader.load(capability.url, context);
    if (!loaderResult.success || !loaderResult.graph) {
      throw new Error(
        `Unable to load "board" Capability with the URL of ${capability.url}.`
      );
    }
    return loaderResult.graph;
  } else if (isUnresolvedPathBoardCapability(capability)) {
    if (!context?.loader) {
      throw new Error(
        `The "board" Capability is a URL, but no loader was supplied.`
      );
    }
    const loaderResult = await context.loader.load(capability.path, context);
    if (!loaderResult.success || !loaderResult.graph) {
      throw new Error(
        `Unable to load "board" Capability with the path of ${capability.path}.`
      );
    }
    return loaderResult.graph;
  }
  throw new Error(
    `Unsupported type of "board" Capability. Perhaps the supplied board isn't actually a GraphDescriptor?`
  );
};

// TODO: Maybe this is just a GraphLoader API? Instead of taking a `string`,
// the `load` method should take an `unknown` that it then tries to
// shape-detect? And this is the code to do it.
export const getGraphDescriptor = async (
  board: unknown,
  context?: NodeHandlerContext
): Promise<GraphDescriptor | undefined> => {
  if (!board) return undefined;

  if (typeof board === "string") {
    const loaderResult = await context?.loader?.load(board, context);
    if (!loaderResult?.success || !loaderResult.graph) {
      throw new Error(`Unable to load graph from "${board}"`);
    }
    return loaderResult.graph;
  } else if (isBreadboardCapability(board)) {
    return graphDescriptorFromCapability(board, context);
  } else if (isGraphDescriptor(board)) {
    return board;
  }
  return undefined;
};

const resolvePath = (
  capability: UnresolvedPathBoardCapability,
  base: URL
): ResolvedURLBoardCapability => {
  const path = capability.path;
  const url = new URL(path, base).href;
  return { kind: "board", url: url };
};

/**
 * Resolves any BreadboardCapability instances that are
 * `UnresolvedPathBoardCapability` to `ResolvedURLBoardCapability`.
 * This must happen at run-time, at the earliest moment when
 * the inputs are received by the BoardRunner.
 */
export const resolveBoardCapabilities = async (
  outputs: OutputValues,
  context: NodeHandlerContext,
  url?: string
): Promise<OutputValues> => {
  resolveBoardCapabilitiesInInputs(outputs, context, url);
  return Promise.resolve(outputs);
};

export const resolveBoardCapabilitiesInInputs = (
  values: Record<string, NodeValue>,
  context: NodeHandlerContext,
  url?: string
) => {
  for (const name in values) {
    const property = values[name];
    if (
      isBreadboardCapability(property) &&
      isUnresolvedPathBoardCapability(property)
    ) {
      const base = url ? new URL(url) : baseURLFromContext(context);
      values[name] = resolvePath(property, base);
    }
  }
  return values;
};
