/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardServer, GraphProvider } from "@google-labs/breadboard";

export async function copy(
  _server1: GraphProvider | BoardServer,
  _server2: GraphProvider | BoardServer
): Promise<void> {
  throw new Error("Not implemented yet");
}

export async function move(
  _server1: GraphProvider | BoardServer,
  _server2: GraphProvider | BoardServer
): Promise<void> {
  throw new Error("Not implemented yet");
}
