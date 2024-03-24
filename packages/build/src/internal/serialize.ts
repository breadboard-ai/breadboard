/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO(aomarks) Switch import to schema package
import type { GraphDescriptor } from "@google-labs/breadboard";
import type {
  BoardDefinition,
  BoardInputPorts,
  BoardOutputPorts,
} from "./board.js";

/**
 * Serialize a Breadboard board to Breadboard Graph Language (BGL) so that it
 * can be executed.
 */
export function serialize(
  _board: BoardDefinition<BoardInputPorts, BoardOutputPorts>
): GraphDescriptor {
  // TODO(aomarks) Implement
  return null as unknown as GraphDescriptor;
}
