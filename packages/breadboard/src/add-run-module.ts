/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { inflateData } from "@breadboard-ai/data";
import { Telemetry } from "@breadboard-ai/jsandbox";
import { CapabilitiesManagerImpl } from "@breadboard-ai/runtime/legacy.js";
import type {
  InputValues,
  Kit,
  MutableGraph,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerObject,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { RunnableModuleFactory } from "@breadboard-ai/types/sandbox.js";

export { addRunModule };

/**
 * This is likely too limiting and crude for the long term, but it works well
 * for the specific use case we need right now.
 *
 * In the future, I am imagining something like a capability attenuator, which
 * allows tuning capabilities for each invoked module, including module
 * invocation itself.
 */
type RunModuleInvocationFilter = (context: NodeHandlerContext) => Outcome<void>;

function findHandler(handlerName: string, kits?: Kit[]) {
  const handler = kits
    ?.flatMap((kit) => Object.entries(kit.handlers))
    .find(([name]) => name === handlerName)
    ?.at(1);

  return handler;
}

function addRunModule(
  factory: RunnableModuleFactory,
  kits: Kit[],
  invocationFilter?: RunModuleInvocationFilter
): Kit[] {
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
            // Run invocation filter first, and report error if it tells us
            // we can't run this module.
            const filtering = invocationFilter?.(context);
            if (!ok(filtering)) return filtering;

            const graph = context.outerGraph;

            const moduleDeclaration = graph?.modules;
            if (!moduleDeclaration) {
              return {
                $error: `Unable to run module: no modules found within board ${context.board?.url || "uknown board"}`,
              };
            }
            const telemetry = Telemetry.create(context);
            const mutable = await getMutableGraph(context);
            if (!mutable) {
              return err(`Unable to create runnable module: invalid graph`);
            }

            const module = await factory.createRunnableModule(
              mutable,
              graph,
              new CapabilitiesManagerImpl(context)
            );
            if (!ok(module)) {
              return err(`Unable to create runnable module: ${module.$error}`);
            }

            const inputs = context.store
              ? ((await inflateData(
                  context.store,
                  rest,
                  context.base
                )) as InputValues)
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
            if (context) {
              const graph = context.outerGraph;
              const moduleDeclaration = graph?.modules;
              if ($module && moduleDeclaration) {
                const modules = Object.fromEntries(
                  Object.entries(moduleDeclaration).map(([name, spec]) => [
                    name,
                    spec.code,
                  ])
                );
                const mutable = await getMutableGraph(context);
                if (mutable) {
                  const module = await factory.createRunnableModule(
                    mutable,
                    graph
                  );
                  if (ok(module)) {
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
                    } catch {
                      // swallow the error. It's okay that some modules don't have
                      // custom describers.
                    }
                  }
                }
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

async function getMutableGraph(
  context: NodeHandlerContext
): Promise<MutableGraph | undefined> {
  if (!context.graphStore) return;
  const { graphStore, outerGraph } = context;
  if (!outerGraph) return;
  const mainGraphId = graphStore.getByDescriptor(outerGraph);
  if (!mainGraphId.success) return;

  return graphStore.getLatest(graphStore.get(mainGraphId.result)!);
}
