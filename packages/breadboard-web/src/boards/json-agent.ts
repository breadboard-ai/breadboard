/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, base, recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";
import { templates } from "@google-labs/template-kit";
import { contextAppender } from "./ask-user.js";

const metadata = {
  title: "JSON Agent",
  description: "An agent-like board that outputs structured data (JSON)",
  version: "0.0.3",
};

const sampleText = `You are building a team of skilled experts to create high quality rhyming poems that will be used as lyrics for jingles in TV commercials. These experts can only read text and produce text. Creating melodies and producing music is not their responsibility. The experts will work as a team, collaborating, creating, reviewing, critiquing, and iteratively improving the quality of the poems.

Please identify the necessary job descriptions of these experts.`;

const sampleSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      descriptions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "expert's title",
            },
            responsibilities: {
              type: "array",
              items: {
                type: "string",
                description: "expert's responsibilities",
              },
            },
          },
        },
      },
    },
  } satisfies Schema,
  null,
  2
);

export default await recipe(({ text, schema, generator, context }) => {
  text.title("Text").examples(sampleText).format("multiline");
  schema
    .title("Schema")
    .examples(sampleSchema)
    .isObject()
    .format("multiline")
    .optional()
    .default("{}");

  generator.title("Generator").optional().default("gemini-generator.json");
  context.title("Context").isArray().examples("[]");

  const schemish = json.schemish({ $id: "schemish", schema });

  const format = templates.promptTemplate({
    $id: "format",
    template: `{{text}}

Reply as valid JSON of the following format:

\`\`\`json
{{schemish}}
\`\`\`
`,
    text,
    schemish: schemish,
  });

  const appender = contextAppender({
    $id: "appendContext",
    text: format.text.isString(),
    context: context.isArray(),
  });

  const agent = core.invoke({
    $id: "agent",
    context: appender.context,
    path: "agent.json",
    generator,
  });

  const validate = json.validateJson({
    $id: "validate",
    json: agent.text.isString(),
    schema,
  });

  base.output({
    $id: "validationError",
    $error: validate.$error,
  });

  return {
    json: validate.json,
    context: agent.context,
  };
}).serialize(metadata);
