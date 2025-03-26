/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capability, CapabilitySpec } from "@breadboard-ai/jsandbox";
import {
  InputValues,
  Kit,
  NodeHandlerContext,
  OutputValues,
  Schema,
} from "../types.js";
import { bubbleUpOutputsIfNeeded } from "../bubble.js";
import { NodeDescriptor, NodeMetadata } from "@breadboard-ai/types";
import { CapabilitiesManager } from "./types.js";
import { invokeDescriber } from "./invoke-describer.js";
import { FileSystemHandlerFactory } from "./file-system-handler-factory.js";

export { CapabilitiesManagerImpl };

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
        inputs.outputSchema,
        new CapabilitiesManagerImpl(context)
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

class CapabilitiesManagerImpl implements CapabilitiesManager {
  constructor(public readonly context?: NodeHandlerContext) {}

  createSpec(): CapabilitySpec {
    try {
      if (this.context) {
        const fs = new FileSystemHandlerFactory(this.context.fileSystem);
        return {
          fetch: getHandler("fetch", this.context),
          secrets: getHandler("secrets", this.context),
          invoke: getHandler("invoke", this.context),
          output: createOutputHandler(this.context),
          describe: createDescribeHandler(this.context),
          query: fs.query(),
          read: fs.read(),
          write: fs.write(),
        };
      }
    } catch (e) {
      // eat error
      // TODO: Make sure this never happens. This will likely happen when
      // a misconfigured context is supplied, which is fine in most cases:
      // we just give you back no capabilities.
    }
    return CapabilitiesManagerImpl.dummies();
  }

  static #dummies?: CapabilitySpec;

  static dummies(): CapabilitySpec {
    if (this.#dummies) return this.#dummies;

    this.#dummies = Object.fromEntries(
      [
        "fetch",
        "secrets",
        "invoke",
        "output",
        "describe",
        "query",
        "read",
        "write",
      ].map((name) => {
        return [name, () => ({ $error: "Capability not available" })];
      })
    );
    return this.#dummies;
  }
}
