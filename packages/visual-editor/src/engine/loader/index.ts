/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphLoader, GraphProvider } from "@breadboard-ai/types";
import { Loader } from "./loader.js";

export const createLoader = (boardServer: GraphProvider): GraphLoader => {
  return new Loader(boardServer);
};
