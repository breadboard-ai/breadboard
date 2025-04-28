/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@breadboard-ai/types";
import type {
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerObject,
  Schema,
  Kit,
  NodeHandlerContext,
} from "./types.js";

import {
  type Sandbox,
  SandboxedModule,
  Telemetry,
} from "@breadboard-ai/jsandbox";
import { inflateData } from "./data/inflate-deflate.js";
import { MutableGraph } from "./inspector/types.js";
import { CapabilitiesManagerImpl } from "./sandbox/capabilities-manager.js";
import { ok } from "./data/file-system/utils.js";
import { Outcome } from "./data/types.js";

export { addSandboxedRunModule };

/**
 * This is likely too limiting and crude for the long term, but it works well
 * for the specific use case we need right now.
 *
 * In the future, I am imagining something like a capability attenuator, which
 * allows tuning capabilities for each invoked module, including module
 * invocation itself.
 */
export type RunModuleInvocationFilter = (
  context: NodeHandlerContext
) => Outcome<void>;

function findHandler(handlerName: string, kits?: Kit[]) {
  const handler = kits
    ?.flatMap((kit) => Object.entries(kit.handlers))
    .find(([name]) => name === handlerName)
    ?.at(1);

  return handler;
}

function addSandboxedRunModule(
  sandbox: Sandbox,
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
            if (context.graphStore) {
              const { graphStore } = context;
              const mainGraphId = graphStore.getByDescriptor(
                context.outerGraph
              );
              if (mainGraphId.success) {
                const mutable = await graphStore.getLatest(
                  graphStore.get(mainGraphId.result)!
                );
                await addImportedModules(modules, mutable);
              }
            }

            const module = new SandboxedModule(
              sandbox,
              new CapabilitiesManagerImpl(context).createSpec(),
              modules
            );
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

async function addImportedModules(
  modules: Record<string, string>,
  mutable: MutableGraph
): Promise<void> {
  const inspectable = mutable.graphs.get("");
  if (!inspectable) return;

  const imports = await inspectable.imports();
  imports.forEach((imported, importName) => {
    if ("$error" in imported) return;

    for (const [moduleName, spec] of Object.entries(imported.modules())) {
      const modulePath = `${importName}/${moduleName}`;
      modules[modulePath] = spec.code();
    }
  });
}
