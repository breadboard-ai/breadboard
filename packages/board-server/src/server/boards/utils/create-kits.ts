/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeSandbox } from "@breadboard-ai/jsandbox/node";
import {
  addSandboxedRunModule,
  asRuntimeKit,
  type Kit,
  type MutableGraphStore,
} from "@google-labs/breadboard";

import Core from "@google-labs/core-kit";

export { registerLegacyKits };

function registerLegacyKits(_graphStore: MutableGraphStore) {}

export const createKits = (overrides: Kit[] = []) => {
  const kits = [asRuntimeKit(Core)];
  return addSandboxedRunModule(new NodeSandbox(), [...overrides, ...kits]);
};
