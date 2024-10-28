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
      runModule: async ({ $module, ...rest }, context) => {
        const module = context.board?.modules?.[$module as string];
        if (!module) {
          throw new Error(`Invalid module ${$module}`);
        }

        const { code } = module;
        const runner = new RunModuleManager(
          new URL(wasm, window.location.href)
        );
        const result = await runner.runModule(code, rest);
        return result;
      },
    },
  };
}
