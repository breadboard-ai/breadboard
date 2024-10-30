/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerObject,
  Schema,
  type Kit,
} from "@google-labs/breadboard";

import { WebModuleManager } from "@breadboard-ai/jsandbox";
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

function addSandboxedRunModule(board: GraphDescriptor, kits: Kit[]): Kit[] {
  const modules = board.modules;
  if (!modules) {
    return kits;
  }

  const runner = new WebModuleManager(
    new URL(wasm, window.location.href),
    Object.fromEntries(
      Object.entries(modules).map(([name, spec]) => [name, spec.code])
    )
  );

  const existingRunModule = findHandler("runModule", kits);
  const originalDescriber =
    (existingRunModule &&
    typeof existingRunModule !== "string" &&
    "describe" in existingRunModule
      ? existingRunModule.describe
      : undefined) ??
    (() => ({
      outputSchema: {},
      inputSchema: {},
    }));

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
            const result = await runner.invoke($module as string, rest);
            return result as InputValues;
          },
          describe: async (
            inputs?: InputValues,
            inputSchema?: Schema,
            outputSchema?: Schema,
            /**
             * The context in which the node is described.
             */
            context?: NodeDescriberContext
          ) => {
            const { $module } = inputs || {};
            if ($module) {
              try {
                const result = (await runner.describe($module as string, {
                  inputs,
                  inputSchema,
                  outputSchema,
                })) as NodeDescriberResult;
                return {
                  inputSchema: {
                    type: "object",
                    properties: {
                      $module: {
                        type: "string",
                        title: "Module ID",
                        behavior: ["config", "module"],
                      },
                      ...result.inputSchema.properties,
                    },
                  },
                  outputSchema: result.outputSchema,
                };
              } catch (e) {
                // swallow the error. It's okay that some modules don't have
                // custom describers.
              }
            }

            return originalDescriber(
              inputs,
              inputSchema,
              outputSchema,
              context
            );
          },
        } satisfies NodeHandlerObject,
      },
    },
    ...kits,
  ];
}
