/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { parseTemplate } from "url-template";

const operators = [
  { prefix: "+", description: "reserved expansion" },
  { prefix: "#", description: "fragment expansion" },
  { prefix: ".", description: "label expansion, dot-prefixed" },
  { prefix: "/", description: "path segment expansion" },
  { prefix: ";", description: "path-style parameter expansion" },
  { prefix: "?", description: "form-style query expansion" },
  { prefix: "&", description: "form-style query continuation" },
] as const;

type UrlTemplateParameters = {
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

/**
 * Use this node to safely construct URLs. This node relies on the
 * [URI template specification](https://tools.ietf.org/html/rfc6570) to
 * construct URLs, so the syntax is using single curly braces instead of
 * double curly braces.
 */
export default defineNodeType({
  name: "urlTemplate",
  metadata: {
    title: "URL Template",
    description:
      "Use this node to safely construct URLs. This node relies on the [URI template specification](https://tools.ietf.org/html/rfc6570) to construct URLs, so the syntax is using single curly braces instead of double curly braces.",
  },
  inputs: {
    template: {
      type: "string",
      title: "Template",
      format: "multiline",
      description: "The URL template to use",
    },
    "*": {
      type: "string",
    },
  },
  outputs: {
    url: {
      type: "string",
      title: "URL",
      description:
        "The resulting URL that was produced by filling in the placeholders in the template",
      primary: true,
    },
  },
  describe: ({ template }) => ({
    inputs: Object.fromEntries(
      getUrlTemplateParameters(template).map(({ name, operator }) => [
        name,
        {
          description: operator?.description
            ? `Value for ${operator.description} placeholder "${name}"`
            : `Value for placeholder "${name}"`,
        },
      ])
    ),
  }),
  invoke: ({ template }, values) => ({
    url: parseTemplate(template).expand(values),
  }),
});
