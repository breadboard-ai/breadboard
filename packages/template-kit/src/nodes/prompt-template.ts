/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import type { InputValues } from "@google-labs/breadboard";

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

/**
 * Use this node to populate simple handlebar-style templates. A required
 * input is `template`, which is a string that contains the template prompt
 * template. The template can contain zero or more placeholders that will be
 * replaced with values from inputs. Specify placeholders as `{{inputName}}`
 * in the template. The placeholders in the template must match the inputs
 * wired into this node. The node will replace all placeholders with values
 * from the input property bag and pass the result along as the `prompt`
 * output property.
 */
export default defineNodeType({
  name: "promptTemplate",
  metadata: {
    title: "Prompt Template",
    description:
      "Use this node to populate simple handlebar-style templates. A required input is `template`, which is a string that contains the template prompt template. The template can contain zero or more placeholders that will be replaced with values from inputs. Specify placeholders as `{{inputName}}` in the template. The placeholders in the template must match the inputs wired into this node. The node will replace all placeholders with values from the input property bag and pass the result along as the `prompt` output property.",
  },
  inputs: {
    template: {
      type: "string",
      title: "Template",
      format: "multiline",
      description: "The template with placeholders to fill in.",
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    prompt: {
      type: "string",
      description:
        "The resulting prompt that was produced by filling in the placeholders in the template.",
      primary: true,
    },
  },
  describe: ({ template }) => ({
    inputs: Object.fromEntries(
      parametersFromTemplate(template).map((parameter) => [
        parameter,
        {
          description: `The value to substitute for the parameter "${parameter}"`,
        },
      ])
    ),
  }),
  invoke: ({ template }, parameters) =>
    promptTemplateHandler(template, parameters),
});
