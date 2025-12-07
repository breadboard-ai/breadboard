/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as musicGeneratorMain from "./main.js";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl.js";

export const exports = {
  main: musicGeneratorMain,
};

export const bgl = createBgl(descriptor, exports);
