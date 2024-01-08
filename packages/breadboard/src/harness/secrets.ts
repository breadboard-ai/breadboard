/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit, type OutputValues } from "@google-labs/breadboard";
import { HarnessRunResult } from "./types.js";
import { LocalResult } from "./result.js";
import { KitBuilder } from "../kits/builder.js";

export const createSecretAskingKit = (
  next: (result: HarnessRunResult) => Promise<void>
) => {
  const secretAskingKit = new KitBuilder({
    url: "secret-asking-kit",
  }).build({
    secrets: async (inputs) => {
      const { keys } = inputs as { keys: string[] };
      if (!keys) return {};
      const result = new LocalResult({ type: "secret", data: { keys } });
      await next(result);
      return result.response as OutputValues;
    },
  });
  return asRuntimeKit(secretAskingKit);
};
