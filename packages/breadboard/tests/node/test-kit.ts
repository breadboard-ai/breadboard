/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGraphDescriptor } from "../../src/capability.js";
import { invokeGraph } from "../../src/run/invoke-graph.js";
import { InputValues, Kit, OutputValues } from "../../src/types.js";

// A simplest possible re-implementation of some nodes to be used in tests
// in tests/bgl/*.

export const testKit: Kit = {
  title: "Test Kit",
  url: import.meta.url,
  handlers: {
    invoke: {
      invoke: async (inputs, context) => {
        const { $board, ...args } = inputs;
        if (!$board) {
          throw new Error("No board provided for the `invoke` handler");
        }
        const graph = await getGraphDescriptor($board, context);
        if (!graph.success) {
          throw new Error(
            "Unable to get graph descriptor from the board in `invoke` handler"
          );
        }
        const base = context.board?.url && new URL(context.board?.url);
        const invocationContext = base
          ? {
              ...context,
              base,
            }
          : { ...context };

        return invokeGraph(graph, args, invocationContext);
      },
    },
    map: {
      metadata: {
        title: "Map",
        tags: ["experimental"],
      },
      invoke: async (inputs, context) => {
        const { board, list = [] } = inputs;
        if (!board) {
          throw new Error("No board provided for the `map` handler");
        }
        const graph = await getGraphDescriptor(board, context);
        if (!graph.success) {
          throw new Error(
            "Unable to get graph descriptor from the board in `map` handler"
          );
        }
        let listArray;
        if (typeof list === "string") {
          listArray = JSON.parse(list);
        } else {
          listArray = list;
        }
        if (!Array.isArray(listArray)) {
          throw new Error(
            "In `map` handler, `list` port value is not an array"
          );
        }
        const base = context.board?.url && new URL(context.board?.url);
        if (context.state) {
          const result: OutputValues[] = [];
          for (const [index, item] of listArray.entries()) {
            const newContext = {
              ...context,
              base: base || context?.base,
              invocationPath: [...(context?.invocationPath || []), index],
            };
            const outputs = await invokeGraph(
              graph,
              { item, index, list },
              newContext
            );
            result.push(outputs);
          }
          return { list: result } as OutputValues;
        } else {
          const result = await Promise.all(
            listArray.map(async (item, index) => {
              const newContext = {
                ...context,
                base: base || context?.base,
                invocationPath: [...(context?.invocationPath || []), index],
              };
              const outputs = await invokeGraph(
                graph,
                { item, index, list },
                newContext
              );
              return outputs;
            })
          );
          return { list: result } as OutputValues;
        }
      },
    },
    promptTemplate: {
      invoke: async (inputs) => {
        const { template, ...parameters } = inputs;
        return promptTemplateHandler(template as string, parameters);
      },
    },
    runJavascript: {
      invoke: async (inputs) => {
        const { code, functionName = "run", raw, ...args } = inputs;
        const vm = await import("node:vm");
        const codeToRun = `${code}\n${functionName}(${JSON.stringify(args)});`;
        const context = vm.createContext({ console, structuredClone });
        const script = new vm.Script(codeToRun);
        const result = await script.runInNewContext(context);
        return raw
          ? result
          : {
              result:
                typeof result === "string" ? result : JSON.stringify(result),
            };
      },
    },
    secrets: {
      invoke: async (inputs) => {
        const { keys } = inputs as { keys: string[] };
        return Object.fromEntries(
          keys.map((key: string) => [key, "secret-value"])
        );
      },
    },
  },
};

// Copied from template-kit/src/nodes/prompt-template.ts
// On 2024-07-29.

export const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  return JSON.stringify(value, null, 2);
};

export const substitute = (template: string, values: InputValues) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, stringify(value)),
    template
  );
};

export const parametersFromTemplate = (
  template: string | undefined
): string[] => {
  if (!template) return [];
  const matches = template.matchAll(/{{(?<name>[\w-]+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  const unique = Array.from(new Set(parameters));
  return unique;
};

const promptTemplateHandler = (
  template: string,
  inputs: { [K: string]: unknown }
) => {
  const parameters = parametersFromTemplate(template);
  if (!parameters.length) return { prompt: template, text: template };

  const substitutes = parameters.reduce((acc, parameter) => {
    if (inputs[parameter] === undefined)
      throw new Error(`Input is missing parameter "${parameter}"`);
    return { ...acc, [parameter]: inputs[parameter] };
  }, {});

  const prompt = substitute(template, substitutes);
  // log.info(`Prompt: ${prompt}`);
  return { prompt, text: prompt };
};
