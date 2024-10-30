/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitConfig, defineServeConfig } from "@google-labs/breadboard/harness";
import GeminiKit from "@google-labs/gemini-kit";
import { loadKits } from "./utils/kit-loader";

const PROXY_NODES = ["secrets", "fetch"];

const kitConstructors = [GeminiKit];

export const createServeConfig = async () => {
  const kits = await loadKits(kitConstructors);
  return defineServeConfig({
    transport: "worker",
    kits: [{ proxy: PROXY_NODES } as KitConfig, ...kits],
    diagnostics: true,
  });
};
