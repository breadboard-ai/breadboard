/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";

export type TemplateParserInputs = InputValues & {
  /**
   * The template to parse.
   */
  template: string;
};

export type TemplateParserOutputs = OutputValues & {
  /**
   * The schema of placeholders, parsed from the template.
   */
  schema: NodeValue;
};

export const parametersFromTemplate = (template: string): string[] => {
  const matches = template.matchAll(/{{(?<name>[\w-]+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  const unique = Array.from(new Set(parameters));
  return unique;
};

export const schemaFromParameters = (parameters: string[]): NodeValue => {
  const properties = parameters.reduce((acc, parameter) => {
    return { ...acc, [parameter]: { type: "string" } };
  }, {});
  return {
    type: "object",
    properties,
    required: parameters,
  };
};

export default async (inputs: InputValues): Promise<OutputValues> => {
  const { template } = inputs as TemplateParserInputs;
  const parameters = parametersFromTemplate(template);
  const schema = schemaFromParameters(parameters);
  return { schema };
};
