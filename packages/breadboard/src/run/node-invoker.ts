/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  bubbleUpInputsIfNeeded,
  createOutputProvider,
  RequestedInputsManager,
} from "../bubble.js";
import { resolveBoardCapabilitiesInInputs } from "../capability.js";
import { callHandler, getHandler } from "../handler.js";
import { resolveGraph, SENTINEL_BASE_URL } from "../loader/loader.js";
import { RunResult } from "../run.js";
import type {
  GraphToRun,
  NodeHandlerContext,
  RunArguments,
  Schema,
} from "../types.js";
import type {
  GraphDescriptor,
  InputValues,
  LLMContent,
  NodeDescriptor,
  NodeIdentifier,
  OutputValues,
  TraversalResult,
} from "@breadboard-ai/types";
import { Template, TemplatePart } from "../utils/template.js";
import {
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
} from "../data/common.js";
import { FileSystem, FileSystemEntry, FileSystemPath } from "../data/types.js";

type ResultSupplier = (result: RunResult) => Promise<void>;

export class NodeInvoker {
  #requestedInputs: RequestedInputsManager;
  #resultSupplier: ResultSupplier;
  #graph: GraphToRun;
  #context: NodeHandlerContext;
  #initialInputs?: InputValues;
  #start?: NodeIdentifier;

  constructor(
    args: RunArguments,
    graph: GraphToRun,
    next: (result: RunResult) => Promise<void>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inputs, start, stopAfter, ...context } = args;
    this.#requestedInputs = new RequestedInputsManager(args);
    this.#resultSupplier = next;
    this.#graph = graph;
    this.#context = context;
    this.#start = start;
    this.#initialInputs = inputs;
  }

  #adjustInputs(result: TraversalResult) {
    const { inputs, current, descriptor } = result;
    if (descriptor.type === "secrets") {
      // Somewhat gross hack: don't supply extra inputs to secret, since
      // it has no inputs.
      // Also, this messes with the proxy server quite a bit, and we are
      // better off not doing this.
      return inputs;
    }
    if (current.from === "$entry") {
      return { ...inputs, ...this.#initialInputs };
    }
    return inputs;
  }

  async invokeNode(result: TraversalResult, invocationPath: number[]) {
    const { descriptor } = result;
    const inputs = this.#adjustInputs(result);

    const requestInput = this.#requestedInputs.createHandler(
      this.#resultSupplier,
      result
    );

    const { kits = [], base = SENTINEL_BASE_URL, state } = this.#context;
    let outputs: OutputValues | undefined = undefined;

    const outerGraph = this.#graph.graph;

    const handler = await getHandler(descriptor.type, {
      ...this.#context,
      outerGraph,
    });

    // Request parameters, if needed.
    const newContext = await this.#getParameters(
      {
        ...this.#context,
        descriptor,
        board: resolveGraph(this.#graph),
        // This is important: outerGraph is the value of the parent graph
        // if this.#graph is a subgraph.
        // Or it equals to "board" it this is not a subgraph
        // TODO: Make this more elegant.
        outerGraph,
        base,
        kits,
        requestInput,
        provideOutput: createOutputProvider(
          this.#resultSupplier,
          result,
          this.#context
        ),
        invocationPath,
        state,
      },
      result,
      descriptor,
      invocationPath
    );

    outputs = (await callHandler(
      handler,
      resolveBoardCapabilitiesInInputs(
        inputs,
        this.#context,
        this.#graph.graph.url
      ),
      newContext
    )) as OutputValues;

    return outputs;
  }

  async #getParameters(
    context: NodeHandlerContext,
    result: TraversalResult,
    descriptor: NodeDescriptor,
    path: number[]
  ): Promise<NodeHandlerContext> {
    const { configuration } = descriptor;
    if (!configuration) return context;
    if (!this.#initialInputs) return context;

    const knownInputs = new Set(Object.keys(this.#initialInputs));
    const params: TemplatePart[] = [];

    // Scan for all LLMContent/LLMContent[] properties
    Object.values(configuration).forEach((value) => {
      let content: LLMContent[] | null = null;
      if (isLLMContent(value)) {
        content = [value];
      } else if (isLLMContentArray(value)) {
        content = value;
      }
      const last = content?.at(-1);
      if (!last) return;

      last.parts.forEach((part) => {
        if (isTextCapabilityPart(part)) {
          const template = new Template(part.text);
          template.placeholders.forEach((placeholder) => {
            if (
              placeholder.type === "param" &&
              !knownInputs.has(placeholder.path)
            ) {
              params.push(placeholder);
            }
          });
        }
      });
    });

    const parameterInputs: FileSystemEntry[] = [];

    if (params.length > 0) {
      // Simulate a subgraph that consists of one node.

      const schema: Schema = {
        type: "object",
        properties: Object.fromEntries(
          params.map((param) => {
            return [
              param.path,
              {
                type: "object",
                title: param.title,
                behavior: ["llm-content"],
              } satisfies Schema,
            ];
          })
        ),
      };

      const paramDescriptor: NodeDescriptor = {
        id: crypto.randomUUID(),
        type: "input",
        configuration: { schema },
      };

      await context.probe?.report?.({
        type: "graphstart",
        data: {
          graph: virtualGraph(),
          graphId: "",
          path: [...path, -1],
          timestamp: timestamp(),
        },
      });

      await context.probe?.report?.({
        type: "nodestart",
        data: {
          node: paramDescriptor,
          inputs: {
            schema,
          },
          path: [...path, -1, -1],
          timestamp: timestamp(),
        },
      });

      const paramsResult = { ...result, inputs: { schema } };
      console.table(params);

      // Pretend to be the invoked node and ask for inputs.
      await bubbleUpInputsIfNeeded(
        this.#graph.graph,
        context,
        paramDescriptor,
        paramsResult,
        [...path, -1, -1]
      );

      if (paramsResult.outputs) {
        parameterInputs.push(
          ...Object.entries(paramsResult.outputs).map(([id, content]) => {
            const path = `/env/parameters/${id}` as FileSystemPath;
            return { path, data: [content] as LLMContent[] };
          })
        );
      }

      await context.probe?.report?.({
        type: "nodeend",
        data: {
          node: paramDescriptor,
          inputs: { schema },
          outputs: paramsResult.outputs || {},
          path: [...path, -1, -1],
          timestamp: timestamp(),
          newOpportunities: [],
        },
      });

      await context.probe?.report?.({
        type: "graphend",
        data: {
          path: [...path, -1],
          timestamp: timestamp(),
        },
      });
    }

    return {
      ...context,
      fileSystem: context.fileSystem?.createModuleFileSystem({
        graphUrl: this.#graph.graph.url!,
        env: updateEnv(
          parameterInputs,
          context.fileSystem,
          this.#initialInputs
        ),
      }),
    };
  }
}

function updateEnv(
  params: FileSystemEntry[],
  fileSystem?: FileSystem,
  inputs?: InputValues
): FileSystemEntry[] {
  const currentEnv = fileSystem?.env() || [];

  const newEnv = inputs
    ? Object.entries(inputs).map(([path, input]) => {
        const data: LLMContent[] = [{ parts: [{ text: input as string }] }];
        return { path: `/env/parameters/${path}`, data } as FileSystemEntry;
      })
    : [];

  return [...currentEnv, ...newEnv, ...params];
}

function virtualGraph(): GraphDescriptor {
  return {
    nodes: [],
    edges: [],
    virtual: true,
  };
}

function timestamp() {
  return globalThis.performance.now();
}
