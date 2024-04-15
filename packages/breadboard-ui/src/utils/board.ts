/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectablePort,
  NodeValue,
  UnresolvedPathBoardCapability,
} from "@google-labs/breadboard";

export const isBoard = (
  port: InspectablePort,
  value: NodeValue
): value is UnresolvedPathBoardCapability | string | undefined => {
  if (!value) return true;
  if (!port.schema.behavior?.includes("board")) return false;
  if (typeof value === "string") return true;
  if (typeof value === "object") {
    const maybeCapability = value as UnresolvedPathBoardCapability;
    return maybeCapability.kind === "board" && !!maybeCapability.path;
  }
  return false;
};
