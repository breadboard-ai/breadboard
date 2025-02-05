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
  OutputValues,
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
import {
  FileSystem,
  FileSystemQueryArguments,
  FileSystemReadArguments,
  FileSystemWriteArguments,
} from "./data/types.js";
import { err, ok } from "./data/file-system/utils.js";
import { MutableGraph } from "./inspector/types.js";

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
      return maybeUnwrapError(result);
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

type DescribeInputs = {
  url: string;
  inputs?: InputValues;
  inputSchema?: Schema;
  outputSchema?: Schema;
};

type DescribeOutputs = {
  $error?: string;
  inputSchema?: Schema;
  outputSchema?: Schema;
};

function createDescribeHandler(context: NodeHandlerContext) {
  return (async (
    inputs: DescribeInputs,
    _invocationPath: number[]
  ): Promise<DescribeOutputs> => {
    const graphStore = context.graphStore;
    if (!graphStore) {
      return { $error: "Unable to describe: GraphStore is unavailable." };
    }
    if (typeof inputs.url !== "string") {
      return {
        $error: `Unable to describe: "${inputs.url}" is not a string`,
      };
    }
    const addResult = graphStore.addByURL(inputs.url, [], context);
    const mutable = await graphStore.getLatest(addResult.mutable);

    const inspectable = mutable.graphs.get(addResult.graphId);

    if (!inspectable) {
      return {
        $error: `Unable to describe: ${inputs.url}: is not inspectable`,
      };
    }

    if (addResult.moduleId) {
      const result = await invokeDescriber(
        addResult.moduleId,
        mutable,
        mutable.graph,
        inputs.inputs || {},
        inputs.inputSchema,
        inputs.outputSchema
      );
      if (!result) {
        return {
          $error: `Unable to describe: ${addResult.moduleId} has no describer`,
        };
      }
      return result;
    } else {
      return inspectable.describe(inputs.inputs);
    }
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
            const fs = new FileSystemHandlerFactory(context.fileSystem);
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
                describe: createDescribeHandler(context),
                query: fs.query(),
                read: fs.read(),
                write: fs.write(),
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
  mutable: MutableGraph,
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
  const module = new SandboxedModule(mutable.store.sandbox, {}, modules);
  try {
    const result = (await module.describe(moduleId, {
      inputs,
      inputSchema,
      outputSchema,
    })) as NodeDescriberResult;
    const moduleData = declarations[moduleId]!;
    const metadata: Omit<NodeDescriberResult, "inputSchema" | "outputSchema"> =
      filterEmptyValues({
        title: result.title ?? moduleData.metadata?.title,
        description: result.description ?? moduleData.metadata?.description,
        metadata: filterEmptyValues({
          icon: result.metadata?.icon ?? moduleData.metadata?.icon,
          help: result.metadata?.help ?? moduleData.metadata?.help,
          tags: result.metadata?.tags ?? moduleData.metadata?.tags,
        }),
      });
    return {
      ...metadata,
      ...result,
    };
  } catch (e) {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
  }
}

async function invokeMainDescriber(
  mutable: MutableGraph,
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
  const module = new SandboxedModule(mutable.store.sandbox, {}, modules);
  try {
    const result = (await module.describe(main, {
      inputs,
      inputSchema,
      outputSchema,
    })) as NodeDescriberResult;
    const metadata: Omit<NodeDescriberResult, "inputSchema" | "outputSchema"> =
      filterEmptyValues({
        title: result.title ?? graph.title,
        description: result.description ?? graph.description,
        metadata: filterEmptyValues({
          icon: result?.metadata?.icon ?? graph.metadata?.icon,
          help: result?.metadata?.help ?? graph.metadata?.help,
          tags: result?.metadata?.tags ?? graph.metadata?.tags,
        }),
      });
    return {
      ...metadata,
      ...result,
    };
  } catch (e) {
    // swallow the error. It's okay that some modules don't have
    // custom describers.
  }
  return false;
}

class FileSystemHandlerFactory {
  constructor(public readonly fs?: FileSystem) {}

  query(): Capability {
    return async (inputs) => {
      if (!this.fs) {
        return err("File system capability is not available");
      }
      return this.fs.query(inputs as FileSystemQueryArguments);
    };
  }

  read(): Capability {
    return async (inputs) => {
      if (!this.fs) {
        return err("File system capability is not available");
      }
      return this.fs.read(inputs as FileSystemReadArguments);
    };
  }

  write(): Capability {
    return async (inputs) => {
      if (!this.fs) {
        return err("File system capability is not available");
      }

      const result = await this.fs.write(inputs as FileSystemWriteArguments);
      if (!ok(result)) {
        return result;
      }
      return {};
    };
  }
}

/**
 * A utility function to filter out empty (null or undefined) values from
 * an object.
 *
 * @param obj -- The object to filter.
 * @returns -- The object with empty values removed.
 */
function filterEmptyValues<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => !!value)
  ) as T;
}

function maybeUnwrapError(o: void | OutputValues): void | OutputValues {
  if (!o) return o;
  if (!("$error" in o)) return o;

  let { $error } = o;

  if (
    $error &&
    typeof $error === "object" &&
    "kind" in $error &&
    $error.kind === "error" &&
    "error" in $error
  ) {
    const error = $error.error as { message: string };
    $error = error.message;
  }

  return { ...o, $error };
}
