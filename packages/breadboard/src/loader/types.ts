/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";

export type GraphProviderCapabilities = {
  load: boolean;
  save: boolean;
};

export type GraphProvider = {
  canProvide(url: URL): false | GraphProviderCapabilities;
  load: (url: URL) => Promise<GraphDescriptor | null>;
};

export type GraphLoader = {
  load: (url: URL) => Promise<GraphDescriptor | null>;
};
