/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriberFunction,
  NodeHandlerFunction,
} from "@google-labs/graph-runner";

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

export const urlTemplateHandler: NodeHandlerFunction<object> = async (
  inputs: InputValues
) => {
  const { template, ...values } = inputs as UrlTemplateInputs;
  const url = parseTemplate(template).expand(values);
  return { url };
};

export const urlTemplateDescriber: NodeDescriberFunction = async () => {
  return {
    inputSchema: {
      type: "object",
      properties: {
        template: {
          title: "template",
          description: "The URL template to use",
          type: "string",
        },
      },
      required: ["template"],
      additionalProperties: true,
    },
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
};
