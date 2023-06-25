/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphContext, InputValues } from "../graph.js";

const substitute = (template: string, values: Record<string, string>) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, value),
    template
  );
};

const parametersFromTemplate = (template: string): string[] => {
  const matches = template.matchAll(/{{(?<name>\w+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  return parameters;
};

export default async (_cx: GraphContext, inputs: InputValues) => {
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
