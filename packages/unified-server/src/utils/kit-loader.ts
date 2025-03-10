/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type KitConstructor,
  type Kit,
  asRuntimeKit,
} from "@google-labs/breadboard";

export const loadKits = async (kiConstructors: KitConstructor<Kit>[]) => {
  return kiConstructors.map((kitConstructor) => asRuntimeKit(kitConstructor));
};
