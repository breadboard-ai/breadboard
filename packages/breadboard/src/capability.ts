/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardCapability,
  GraphDescriptorBoardCapability,
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
  capability: UnresolvedPathBoardCapability
): capability is UnresolvedPathBoardCapability => {
  const maybe = capability as UnresolvedPathBoardCapability;
  const path = maybe.path;
  return !!path;
};
