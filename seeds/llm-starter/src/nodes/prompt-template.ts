/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberFunction,
  NodeHandler,
  NodeHandlerFunction,
  Schema,
} from "@google-labs/breadboard";

export type PropmtTemplateOutputs = {
  prompt: string;
};

export type PromptTemplateInputs = {
  template: string;
};

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

export const parametersFromTemplate = (template: string): string[] => {
  const matches = template.matchAll(/{{(?<name>[\w-]+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  const unique = Array.from(new Set(parameters));
  return unique;
};

export const promptTemplateHandler: NodeHandlerFunction = async (
  inputs: InputValues
) => {
  const template = inputs.template as string;
  const parameters = parametersFromTemplate(template);
  if (!parameters.length) return { prompt: template };

  const substitutes = parameters.reduce((acc, parameter) => {
    if (inputs[parameter] === undefined)
      throw new Error(`Input is missing parameter "${parameter}"`);
    return { ...acc, [parameter]: inputs[parameter] };
  }, {});

  const prompt = substitute(template, substitutes);
  // log.info(`Prompt: ${prompt}`);
  return { prompt };
};

export const computeInputSchema = (inputs: InputValues): Schema => {
  const parameters = parametersFromTemplate((inputs.template ?? "") as string);
  const properties: Schema["properties"] = parameters.reduce(
    (acc, parameter) => {
      const schema = {
        title: parameter,
        description: `The value to substitute for the parameter "${parameter}"`,
        type: ["string", "object"],
      };
      return { ...acc, [parameter]: schema };
    },
    {}
  );
  properties["template"] = {
    title: "template",
    description: "The template with placeholders to fill in.",
    type: "string",
  };
  return {
    type: "object",
    properties,
    required: ["template", ...parameters],
  };
};

export const promptTemplateDescriber: NodeDescriberFunction = async (
  inputs?: InputValues
) => {
  return {
    inputSchema: computeInputSchema(inputs || {}),
    outputSchema: {
      type: "object",
      properties: {
        prompt: {
          title: "prompt",
          description:
            "The resulting prompt that was produced by filling in the placeholders in the template.",
          type: "string",
        },
      },
      required: ["prompt"],
    },
  };
};

export default {
  describe: promptTemplateDescriber,
  invoke: promptTemplateHandler,
} satisfies NodeHandler;
