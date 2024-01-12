/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit, type OutputValues } from "@google-labs/breadboard";
import { SecretResult } from "./types.js";
import { KitBuilder } from "../kits/builder.js";
import { ClientRunResult } from "../remote/run.js";

export const createSecretAskingKit = (
  next: (result: ClientRunResult<SecretResult>) => Promise<void>
) => {
  const secretAskingKit = new KitBuilder({
    url: "secret-asking-kit",
  }).build({
    secrets: async (inputs) => {
      const { keys } = inputs as { keys: string[] };
      if (!keys) return {};
      let outputs = {};
      await next({
        type: "secret",
        data: { keys },
        reply: async (value) => {
          outputs = value.inputs;
        },
      });
      return outputs as OutputValues;
    },
  });
  return asRuntimeKit(secretAskingKit);
};
