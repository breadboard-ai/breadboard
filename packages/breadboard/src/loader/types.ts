/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";

export type GraphProvider = {
  canHandle(url: URL): boolean;
  load: (url: URL) => Promise<GraphDescriptor | null>;
};
