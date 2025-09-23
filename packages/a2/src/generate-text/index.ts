/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as generateTextChatTools from "./chat-tools";
import * as generateTextEntry from "./entry";
import * as generateTextJoin from "./join";
import * as generateTextMain from "./main";
import * as generateTextSystemInstruction from "./system-instruction";
import * as generateTextSystemInstructionTs from "./system-instruction-ts";
import * as generateTextTypes from "./types";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  "chat-tools": generateTextChatTools,
  entry: generateTextEntry,
  join: generateTextJoin,
  main: generateTextMain,
  "system-instruction-ts": generateTextSystemInstructionTs,
  "system-instruction": generateTextSystemInstruction,
  types: generateTextTypes,
};

export const bgl = createBgl(descriptor, exports);
