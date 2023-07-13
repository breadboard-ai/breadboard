/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "../types.js";

/**
 * A simple node for making valid URLs out of templates.
 */

type UrlTemplateInputValues = {
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
  const { template, ...values } = inputs as UrlTemplateInputValues;
  const url = substitute(template, values);
  return { url };
};
