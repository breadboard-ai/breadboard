/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as audioGeneratorMain from "./main";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

export const exports = {
  main: audioGeneratorMain,
};

export const bgl = createBgl(descriptor, exports);
