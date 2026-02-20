/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as generateTextMain from "./main.js";
import * as generateTextSystemInstruction from "./system-instruction.js";

import * as generateTextTypes from "./types.js";

export const exports = {
  main: generateTextMain,

  "system-instruction": generateTextSystemInstruction,
  types: generateTextTypes,
};
