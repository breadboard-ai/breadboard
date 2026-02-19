/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardServer } from "@breadboard-ai/types";
import {
  EmbeddedBoardServer,
  isFromEmbeddedServer,
} from "./embedded-board-server.js";

export { createA2ModuleFactory } from "./runnable-module-factory.js";
export { createA2Server, isA2 };

const SERVER_NAME = "a2";

function isA2(url: URL | string | undefined) {
  return isFromEmbeddedServer(url, SERVER_NAME);
}

function createA2Server(): BoardServer {
  return new EmbeddedBoardServer("A2", SERVER_NAME, new Map());
}
