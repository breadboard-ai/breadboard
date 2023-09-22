/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

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
   * @example https://example.com/{{path}}
   */
  template: string;
};

export default async (inputs: InputValues) => {
  const { template, ...values } = inputs as UrlTemplateInputs;
  const url = parseTemplate(template).expand(values);
  return { url };
};
