/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriptor,
  NodeHandlerContext,
  OutputValues,
  Schema,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
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

/**
 * Creates the input capability handler for A2 modules.
 *
 * Uses the direct-access path via getProjectRunState() to call
 * consoleEntry.requestInput(schema), which creates a WorkItem,
 * sets the reactive `input` signal on the parent run, and returns
 * a Promise that resolves when the user provides values.
 *
 * This replaces the old 6-layer bubbling chain:
 *   createInputHandler -> bubbleUpInputsIfNeeded -> createBubbleHandler
 *   -> context.requestInput -> RequestedInputsManager -> InputStageResult
 *   -> PlanRunner event loop -> ReactiveProjectRun.#input()
 */
function createInputHandler(context: NodeHandlerContext) {
  return (async (allInputs: InputValues) => {
    const { schema } = allInputs;
    const runState = context.getProjectRunState?.();
    const nodeId = context.currentStep?.id;
    const entry = nodeId && runState?.console.get(nodeId);
    if (!entry) {
      return err(
        `Unable to request input: no console entry found for node "${nodeId}"`
      );
    }
    return entry.requestInput(schema as Schema);
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
