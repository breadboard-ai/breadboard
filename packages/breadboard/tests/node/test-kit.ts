/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, Kit } from "../../src/types.js";

// A simplest possible re-implementation of some nodes to be used in tests
// in tests/bgl/*.

export const testKit: Kit = {
  url: import.meta.url,
  handlers: {
    promptTemplate: {
      invoke: async (inputs) => {
        const { template, ...parameters } = inputs;
        promptTemplateHandler(template as string, parameters);
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
