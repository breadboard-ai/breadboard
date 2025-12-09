/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphInlineMetadata,
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  NodeMetadata,
  OutputValues,
  Schema,
  TraversalResult,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { bubbleUpInputsIfNeeded, bubbleUpOutputsIfNeeded } from "../bubble.js";
import { FileSystemHandlerFactory } from "./file-system-handler-factory.js";
import { invokeDescriber } from "./invoke-describer.js";
import {
  CapabilitiesManager,
  CapabilitySpec,
  Capability,
} from "@breadboard-ai/types/sandbox.js";
import { invokeGraph } from "../run/invoke-graph.js";
import { getGraphDescriptor } from "../../loader/capability.js";

export { CapabilitiesManagerImpl };

function createInvokeHandler(context: NodeHandlerContext): Capability {
  return (async (inputs: InputValues, invocationPath: number[]) => {
    try {
      const { $board, ...args } = inputs;
      if (!$board || typeof $board !== "string") {
        return err(`The "$board" argument is required to invoke`);
      }
      const graph = await getGraphDescriptor($board, context);
      if (!graph.success) {
        return err(graph.error);
      }
      // If the current board has a URL, pass it as new base.
      // Otherwise, use the previous base.
      const base = context.board?.url && new URL(context.board?.url);
      const descriptor: NodeDescriptor = {
        id: `invoke-called-from-run-module`,
        type: "invoke",
      };
      const invocationContext: NodeHandlerContext = base
        ? { ...context, base, invocationPath, descriptor }
        : { ...context, invocationPath, descriptor };

      return maybeUnwrapError(
        await invokeGraph(graph, args, invocationContext)
      );
    } catch (e) {
      return err((e as Error).message);
    }
  }) as Capability;
}

function maybeUnwrapError(o: void | OutputValues): void | OutputValues {
  if (!o) return o;
  if (!("$error" in o)) return o;

  let { $error } = o;

  let m = {};

  if ($error && typeof $error === "object" && "error" in $error) {
    const error = $error.error as { message: string };
    if ("metadata" in $error) {
      m = { metadata: $error.metadata };
    }
    $error = error.message;
  }

  return { ...o, $error, ...m };
}

function createInputHandler(context: NodeHandlerContext) {
  return (async (allInputs: InputValues, invocationPath: number[]) => {
    const { schema, $metadata } = allInputs;
    const graphMetadata: GraphInlineMetadata = {};
    const descriptor: NodeDescriptor = {
      id: "input-from-run-module",
      type: "input",
      configuration: {
        schema: {
          ...(schema as Schema),
          behavior: ["bubble"],
        } satisfies Schema,
      },
    };
    if ($metadata) {
      descriptor.metadata = $metadata as NodeMetadata;
    }
    const result = { inputs: { schema } } as unknown as TraversalResult;
    await bubbleUpInputsIfNeeded(
      graphMetadata,
      context,
      descriptor,
      result,
      invocationPath
    );
    return result.outputs;
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
    try {
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
          context,
          addResult.moduleId,
          mutable,
          mutable.graph,
          inputs.inputs || {},
          inputs.inputSchema,
          inputs.outputSchema,
          new CapabilitiesManagerImpl(context),
          false
        );
        if (!result) {
          return {
            $error: `Unable to describe: ${addResult.moduleId} has no describer`,
          };
        }
        return result;
      } else {
        return inspectable.describe(inputs.inputs, context);
      }
    } catch (e) {
      return err(`Unable to describe: ${(e as Error).message}`);
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
          invoke: createInvokeHandler(this.context),
          input: createInputHandler(this.context),
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
      console.warn(`Unable to create spec: ${(e as Error).message}`);
    }
    return CapabilitiesManagerImpl.dummies();
  }

  static #dummies?: CapabilitySpec;

  static dummies(): CapabilitySpec {
    if (this.#dummies) return this.#dummies;

    this.#dummies = Object.fromEntries(
      [
        "invoke",
        "input",
        "output",
        "describe",
        "query",
        "read",
        "write",
        "blob",
      ].map((name) => {
        return [name, () => ({ $error: "Capability not available" })];
      })
    );
    return this.#dummies;
  }
}
