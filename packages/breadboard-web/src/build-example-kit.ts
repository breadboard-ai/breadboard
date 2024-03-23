/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineNodeType,
  anyOf,
  type NodeFactoryFromDefinition,
} from "@breadboard-ai/build";
import { addKit } from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";

const reverseString = defineNodeType({
  inputs: {
    forwards: {
      type: "string",
      description: "The string to reverse",
    },
  },
  outputs: {
    backwards: {
      type: "string",
      description: "The reversed string",
      primary: true,
    },
  },
  invoke: ({ forwards }) => {
    return {
      backwards: forwards.split("").reverse().join(""),
    };
  },
});

export const templater = defineNodeType({
  inputs: {
    template: {
      type: "string",
      description: "A template with {{placeholders}}.",
    },
    "*": {
      type: anyOf("string", "number"),
      description: "Values to fill into template's {{placeholders}}.",
    },
  },
  outputs: {
    result: {
      type: "string",
      description: "The template with {{placeholders}} substituted.",
    },
  },
  describe: ({ template }) => {
    return {
      inputs: Object.fromEntries(
        extractPlaceholders(template ?? "").map((name) => [
          name,
          {
            type: anyOf("string", "number"),
            description: `A value for the ${name} placeholder`,
          },
        ])
      ),
    };
  },
  invoke: ({ template }, placeholders) => {
    return {
      result: substituteTemplatePlaceholders(template, placeholders),
    };
  },
});

function extractPlaceholders(template: string): string[] {
  const matches = template.matchAll(/{{(?<name>[\w-]+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  const unique = Array.from(new Set(parameters));
  return unique;
}

function substituteTemplatePlaceholders(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, String(value)),
    template
  );
}

const BuildExampleKit = new KitBuilder({
  title: "Example Kit",
  description: "An example kit",
  version: "0.1.0",
  url: "npm:@breadboard-ai/example-kit",
}).build({ reverseString, templater });
export default BuildExampleKit;

export const buildExampleKit = addKit(BuildExampleKit) as {
  reverseString: NodeFactoryFromDefinition<typeof reverseString>;
  templater: NodeFactoryFromDefinition<typeof templater>;
};
