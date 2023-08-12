/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

/**
 * A simple node for making valid URLs out of templates.
 */

export type UrlTemplateOutputs = {
  url: string;
};

export type UrlTemplateInputs = {
  /**
   * The URL template to use
   * @example https://example.com/{{path}}
   */
  template: string;
};

const substitute = (template: string, values: Record<string, string>) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, encodeURIComponent(value)),
    template
  );
};

export default async (inputs: InputValues) => {
  const { template, ...values } = inputs as UrlTemplateInputs;
  const url = substitute(template, values);
  return { url };
};
