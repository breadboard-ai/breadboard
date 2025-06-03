/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit, MutableGraphStore } from "@google-labs/breadboard";

import Core from "@google-labs/core-kit";

export { registerLegacyKits };

function registerLegacyKits(_graphStore: MutableGraphStore) {}

export const loadKits = () => {
  const kits = [asRuntimeKit(Core)];
  return kits;
};
