/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeHandlerContext,
  type Kit,
} from "@google-labs/breadboard";

import { RunModuleManager } from "@breadboard-ai/jsandbox";
import wasm from "/sandbox.wasm?url";

import { Capabilities } from "@breadboard-ai/jsandbox";

export { addSandboxedRunModule };

function findHandler(handlerName: string, kits?: Kit[]) {
  const handler = kits
    ?.flatMap((kit) => Object.entries(kit.handlers))
    .find(([name]) => name === handlerName)
    ?.at(1);

  return handler;
}

function getHandler(handlerName: string, context: NodeHandlerContext) {
  const handler = findHandler(handlerName, context.kits);

  if (!handler || typeof handler === "string") {
    throw new Error("Trying to get one of the non-core handlers");
  }

  const invoke = "invoke" in handler ? handler.invoke : handler;

  return [
    handlerName,
    async (inputs: InputValues) => {
      try {
        return invoke(inputs as InputValues, context);
      } catch (e) {
        return { $error: (e as Error).message };
      }
    },
  ] as [
    string,
    (inputs: Record<string, unknown>) => Promise<Record<string, unknown>>,
  ];
}

function addSandboxedRunModule(kits: Kit[]): Kit[] {
  const existingRunModule = findHandler("runModule", kits);
  const describe =
    existingRunModule &&
    typeof existingRunModule !== "string" &&
    "describe" in existingRunModule
      ? existingRunModule.describe
      : undefined;

  console.log("DESCRIBE", describe);

  return [
    {
      url: import.meta.url,
      handlers: {
        runModule: {
          invoke: async ({ $module, ...rest }, context) => {
            Capabilities.instance().install([
              getHandler("fetch", context),
              getHandler("secrets", context),
            ]);

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
          describe,
        },
      },
    },
    ...kits,
  ];
}
