/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { baseURLFromContext } from "./loader/loader.js";
import {
  BreadboardCapability,
  GraphDescriptorBoardCapability,
  NodeHandlerContext,
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
 * @param outputsPromise
 * @returns
 */
export const resolveBoardCapabilities = async (
  outputsPromise: Promise<OutputValues>,
  context: NodeHandlerContext
): Promise<OutputValues> => {
  const outputs = await outputsPromise;
  for (const name in outputs) {
    const property = outputs[name];
    if (
      isBreadboardCapability(property) &&
      isUnresolvedPathBoardCapability(property)
    ) {
      outputs[name] = resolvePath(property, baseURLFromContext(context));
    }
  }
  return Promise.resolve(outputs);
};
