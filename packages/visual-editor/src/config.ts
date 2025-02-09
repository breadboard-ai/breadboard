/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitConfig, defineServeConfig } from "@google-labs/breadboard/harness";
import { loadKits } from "./utils/kit-loader";

const PROXY_NODES = ["secrets", "fetch"];

export const createServeConfig = async () => {
  const kits = loadKits();
  return defineServeConfig({
    transport: "worker",
    kits: [{ proxy: PROXY_NODES } as KitConfig, ...kits],
    diagnostics: true,
  });
};
