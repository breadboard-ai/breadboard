/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenVendorImpl } from "./token-vendor.js";
import { ConnectionEnvironment, GrantStore } from "./types.js";

export { createTokenVendor };

function createTokenVendor(
  store: GrantStore,
  environment: ConnectionEnvironment
) {
  return new TokenVendorImpl(store, environment);
}

export type * from "./types.js";
