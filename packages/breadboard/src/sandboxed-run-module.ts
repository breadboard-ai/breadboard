/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  GraphDescriptor,
  ModuleIdentifier,
  NodeDescriptor,
  NodeMetadata,
} from "@breadboard-ai/types";
import type {
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerObject,
  Schema,
  Kit,
} from "./types.js";

import {
  type Capability,
  type Sandbox,
  SandboxedModule,
  Telemetry,
} from "@breadboard-ai/jsandbox";
import { inflateData } from "./data/inflate-deflate.js";
import { bubbleUpOutputsIfNeeded } from "./bubble.js";

export { addSandboxedRunModule, invokeDescriber, invokeMainDescriber };

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

  return (async (inputs: InputValues, invocationPath: number[]) => {
    try {
      const result = await invoke(inputs as InputValues, {
        ...context,
        invocationPath,
        descriptor: {
          id: `${handlerName}-called-from-run-module`,
          type: handlerName,
        },
      });
      return result;
    } catch (e) {
      return { $error: (e as Error).message };
    }
  }) as Capability;
}

function createOutputHandler(context: NodeHandlerContext) {
  return (async (allInputs: InputValues, invocationPath: number[]) => {
    const schema = allInputs.schema as Schema;
    const descriptor: NodeDescriptor = {
      id: "output-from-run-module",
      type: "output",
      configuration: {
        schema: {
          ...schema,
          behavior: ["bubble"],
        } satisfies Schema,
      },
    };
    const { $metadata, ...inputs } = allInputs;
    const metadata = $metadata as NodeMetadata | undefined;
    if (metadata) {
      descriptor.metadata = metadata;
    }
    const delivered = await bubbleUpOutputsIfNeeded(
      inputs,
      descriptor,
      context,
      invocationPath
    );
    return { delivered };
  }) as Capability;
}

function addSandboxedRunModule(sandbox: Sandbox, kits: Kit[]): Kit[] {
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
            const moduleDeclaration = context.outerGraph?.modules;
            if (!moduleDeclaration) {
              return {
                $error: `Unable to run module: no modules found within board ${context.board?.url || "uknown board"}`,
              };
            }
            const telemetry = Telemetry.create(context);
            const modules = Object.fromEntries(
              Object.entries(moduleDeclaration).map(([name, spec]) => [
                name,
                spec.code,
              ])
            );
            const module = new SandboxedModule(
              sandbox,
              {
                fetch: getHandler("fetch", context),
                secrets: getHandler("secrets", context),
                invoke: getHandler("invoke", context),
                output: createOutputHandler(context),
              },
              modules
            );
            const inputs = context.store
              ? ((await inflateData(context.store, rest)) as InputValues)
              : rest;
            const result = await module.invoke(
              $module as string,
              inputs,
              telemetry
            );
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
            const moduleDeclaration = context?.outerGraph?.modules;
            if ($module && moduleDeclaration) {
              const modules = Object.fromEntries(
                Object.entries(moduleDeclaration).map(([name, spec]) => [
                  name,
                  spec.code,
                ])
              );
              const module = new SandboxedModule(sandbox, {}, modules);
              try {
                const result = (await module.describe($module as string, {
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

async function invokeDescriber(
  moduleId: ModuleIdentifier,
  sandbox: Sandbox,
  graph: GraphDescriptor,
  inputs: InputValues,
  inputSchema?: Schema,
  outputSchema?: Schema
): Promise<NodeDescriberResult | undefined> {
  const declarations = graph.modules;
  if (!declarations) {
    return;
  }
  const modules = Object.fromEntries(
    Object.entries(declarations).map(([name, spec]) => [name, spec.code])
  );
  const module = new SandboxedModule(sandbox, {}, modules);
  try {
    return module.describe(moduleId, {
      inputs,
      inputSchema,
      outputSchema,
    }) as Promise<NodeDescriberResult>;
  } catch (e) {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
  }
}

async function invokeMainDescriber(
  sandbox: Sandbox,
  graph: GraphDescriptor,
  inputs: InputValues,
  inputSchema?: Schema,
  outputSchema?: Schema
): Promise<NodeDescriberResult | undefined | false> {
  const { main, modules: declarations } = graph;
  if (!declarations || !main) {
    return false;
  }
  const modules = Object.fromEntries(
    Object.entries(declarations).map(([name, spec]) => [name, spec.code])
  );
  const module = new SandboxedModule(sandbox, {}, modules);
  try {
    return module.describe(main, {
      inputs,
      inputSchema,
      outputSchema,
    }) as Promise<NodeDescriberResult>;
  } catch (e) {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
  }
  return false;
}
