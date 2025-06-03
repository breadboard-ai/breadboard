/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit } from "@google-labs/breadboard";

import Core from "@google-labs/core-kit";

export { registerLegacyKits };

function registerLegacyKits() {}

export const loadKits = () => {
  const kits = [asRuntimeKit(Core)];
  return kits;
};
