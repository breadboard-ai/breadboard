/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Kit } from "@google-labs/breadboard";

import { RunModuleManager } from "@breadboard-ai/jsandbox";
import wasm from "/sandbox.wasm?url";

export { createKit };

function createKit(): Kit {
  return {
    url: import.meta.url,
    handlers: {
      runModule: async ({ $code: code, ...rest }) => {
        const runner = new RunModuleManager(
          new URL(wasm, window.location.href)
        );
        const result = await runner.runModule(code as string, rest);
        return result;
      },
    },
  };
}
