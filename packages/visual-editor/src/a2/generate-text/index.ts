/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as generateTextChatTools from "./chat-tools.js";
import * as generateTextMain from "./main.js";
import * as generateTextSystemInstruction from "./system-instruction.js";
import * as generateTextSystemInstructionTs from "./system-instruction-ts.js";
import * as generateTextTypes from "./types.js";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl.js";

export const exports = {
  "chat-tools": generateTextChatTools,
  main: generateTextMain,
  "system-instruction-ts": generateTextSystemInstructionTs,
  "system-instruction": generateTextSystemInstruction,
  types: generateTextTypes,
};

export const bgl = createBgl(descriptor, exports);
