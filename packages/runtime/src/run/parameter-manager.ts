/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystem,
  FileSystemEntry,
  FileSystemPath,
  GraphDescriptor,
  InputValues,
  LLMContent,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlerContext,
  Schema,
  TraversalResult,
} from "@breadboard-ai/types";
import { bubbleUpInputsIfNeeded } from "../bubble.js";
import {
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
} from "@breadboard-ai/data";
import { Template, TemplatePart } from "@breadboard-ai/utils";

export { ParameterManager };

class ParameterManager {
  private readonly graph: GraphDescriptor;
  private readonly inputs?: InputValues;

  constructor(graph: GraphDescriptor, inputs?: InputValues) {
    this.graph = graph;
    this.inputs = inputs;
  }

  propertiesSchema(): Record<string, Schema> {
    const params = this.#scanGraph();

    return Object.fromEntries(
      params.map((param) => {
        const id = param.path;
        return [
          id,
          {
            type: "object",
            behavior: ["llm-content"],
            description: param.title,
          },
        ];
      })
    );
  }

  #scanGraph(): TemplatePart[] {
    const knownParams = new Set(Object.keys(this.inputs || {}));
    return this.graph.nodes
      .map(({ configuration }) => {
        if (!configuration) return null;

        return this.#scanConfiguration(knownParams, configuration);
      })
      .filter((item) => item !== null)
      .flat();
  }

  #scanConfiguration(
    knownParams: Set<string>,
    configuration: NodeConfiguration
  ): TemplatePart[] {
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
              !knownParams.has(placeholder.path)
            ) {
              params.push(placeholder);
              knownParams.add(placeholder.path);
            }
          });
        }
      });
    });

    return params;
  }

  async requestParameters(
    context: NodeHandlerContext,
    path: number[],
    result: TraversalResult
  ): Promise<NodeHandlerContext> {
    const { inputs, graph } = this;
    const { descriptor } = result;
    const { configuration } = descriptor;
    if (!configuration) return context;

    const knownInputs = new Set(Object.keys(this.inputs || {}));
    const params = this.#scanConfiguration(knownInputs, configuration);
    const parameterInputs: FileSystemEntry[] = [];

    if (params.length > 0) {
      console.table(params);

      // Simulate a subgraph that consists of 1+ input nodes.

      await context.probe?.report?.({
        type: "graphstart",
        data: {
          graph: virtualGraph(),
          graphId: "",
          path: [...path, -1],
          timestamp: timestamp(),
        },
      });

      // TODO: Implement support for multiple inputs at once.
      for (const [idx, param] of params.entries()) {
        const metadata = graph.metadata?.parameters?.[param.path];
        const format = metadata?.modality?.join(",") || "text";
        const firstSample = (metadata?.sample as LLMContent[])?.at(0);
        const sample = firstSample
          ? { examples: [JSON.stringify(firstSample)] }
          : {};

        const schema: Schema = {
          type: "object",
          properties: {
            [param.path]: {
              type: "object",
              title: metadata?.title || param.title,
              description: metadata?.description || param.title,
              behavior: ["llm-content"],
              ...sample,
              format,
            },
          },
        };

        const paramDescriptor: NodeDescriptor = {
          id: crypto.randomUUID(),
          type: "input",
          configuration: { schema },
        };

        await context.probe?.report?.({
          type: "nodestart",
          data: {
            node: paramDescriptor,
            inputs: { schema },
            path: [...path, -1, idx],
            timestamp: timestamp(),
          },
        });

        const paramsResult = { ...result, inputs: { schema } };

        await bubbleUpInputsIfNeeded(
          graph,
          context,
          paramDescriptor,
          paramsResult,
          [...path, -1, idx]
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
            path: [...path, -1, idx],
            timestamp: timestamp(),
            newOpportunities: [],
          },
        });
      }

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
        graphUrl: graph.url!,
        env: updateEnv(parameterInputs, context.fileSystem, inputs),
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
        let data: LLMContent[];
        if (typeof input === "string") {
          data = [{ parts: [{ text: input }] }];
        } else if (isLLMContent(input)) {
          data = [input];
        } else {
          data = input as LLMContent[];
        }
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
