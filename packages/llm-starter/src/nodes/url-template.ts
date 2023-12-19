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

import { parseTemplate } from "url-template";

/**
 * A simple node for making valid URLs out of templates.
 */

export type UrlTemplateOutputs = {
  url: string;
};

export type UrlTemplateInputs = {
  /**
   * The URL template to use
   * @example https://example.com/{path}
   */
  template: string;
};

export const urlTemplateHandler: NodeHandlerFunction = async (
  inputs: InputValues
) => {
  const { template, ...values } = inputs as UrlTemplateInputs;
  const url = parseTemplate(template).expand(values);
  return { url };
};

const operators = [
  { prefix: "+", description: "reserved expansion" },
  { prefix: "#", description: "fragment expansion" },
  { prefix: ".", description: "label expansion, dot-prefixed" },
  { prefix: "/", description: "path segment expansion" },
  { prefix: ";", description: "path-style parameter expansion" },
  { prefix: "?", description: "form-style query expansion" },
  { prefix: "&", description: "form-style query continuation" },
] as const;

export type UrlTemplateParameters = {
  name: string;
  operator?: (typeof operators)[number];
}[];

export const getUrlTemplateParameters = (
  template?: string
): UrlTemplateParameters => {
  if (!template) return [];
  const matches = [...template.matchAll(/{([^{}]+)\}|([^{}]+)/g)];
  return matches
    .map((match) => match[1])
    .filter(Boolean)
    .map((name) => {
      const prefix = name.charAt(0);
      const operator = operators.find((op) => op.prefix === prefix);
      if (operator) {
        return { name: name.slice(1), operator };
      }
      return { name };
    });
};

export const computeInputSchema = (template?: string): Schema => {
  const parameters = getUrlTemplateParameters(template);
  const properties = parameters.reduce(
    (acc, { name, operator }) => {
      const description = operator?.description
        ? `Value for ${operator.description} placeholder "${name}"`
        : `Value for placeholder "${name}"`;
      acc[name] = {
        title: name,
        description,
        type: "string",
      };
      return acc;
    },
    {
      template: {
        title: "template",
        description: "The URL template to use",
        type: "string",
      },
    } as Record<string, Schema>
  );
  return {
    type: "object",
    properties,
    required: ["template", ...parameters.map(({ name }) => name)],
  };
};

export const urlTemplateDescriber: NodeDescriberFunction = async (
  inputs?: InputValues
) => {
  const { template } = (inputs || {}) as UrlTemplateInputs;
  return {
    inputSchema: computeInputSchema(template),
    outputSchema: {
      type: "object",
      properties: {
        url: {
          title: "url",
          description:
            "The resulting URL that was produced by filling in the placeholders in the template",
          type: "string",
        },
      },
      required: ["url"],
    },
  };
};

export default {
  describe: urlTemplateDescriber,
  invoke: urlTemplateHandler,
} satisfies NodeHandler;
