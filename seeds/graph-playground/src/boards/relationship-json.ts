/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import { Nursery } from "@google-labs/node-nursery";

const jsonPrompt = new Board({
  title: "Simple JSON prompt",
  description:
    "Asks a question and then asks for a JSON object as an answer. The JSON object is validated against a schema.",
  version: "0.0.1",
});
const kit = jsonPrompt.addKit(Starter);
const core = jsonPrompt.addKit(Core);
const nursery = jsonPrompt.addKit(Nursery);

const schema = {
  type: "object",
  properties: {
    people: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer", minimum: 0 },
        },
        required: ["name"],
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["friend", "parent", "child", "sibling", "spouse", "other"],
          },
          person1Name: { type: "string" },
          person2Name: { type: "string" },
        },
        required: ["type", "person1Name", "person2Name"],
      },
    },
  },
};

// Validate that the LLM didn't make up the ages.
function checker({
  text,
  json,
}: {
  text: string;
  json: { people: [{ name: string; age: number }] };
}) {
  // See whether age appears in the text. This is an overly simple check that
  // doesn't even allow for "fourteen" instead of 14. For a real implementation,
  // use an LLM to fact check itself.
  const notFound = json.people.filter(
    (person) => person.age && text.indexOf(`${person.age}`) === -1
  );
  if (notFound.length > 0)
    return {
      $error: {
        kind: "error",
        error: {
          message: `Age not found in scene for ${notFound
            .map((person) => person.name)
            .join(", ")}.`,
        },
      },
    };
  else return { json };
}

jsonPrompt
  .input({
    $id: "scene",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Question",
          description:
            "Describe a scene with multiple people, the LLM will try to map out the relationships between the people",
        },
      },
      required: ["scene"],
    },
  })
  .wire(
    "text->scene",
    kit
      .promptTemplate(
        "You are a tool that given a scene understands the relationship between people and describes them in the following JSON schema. Age is optional, don't make it up. Only use the relations in the schema:\n\n{{schema}}\n\nScene:\n{{scene}}\n",
        { schema: JSON.stringify(schema) }
      )
      .wire(
        "prompt->text",
        core
          .invoke({ path: "./retry.json" })
          .wire(
            "lambda<-board",
            jsonPrompt.lambda((_, input, output) => {
              const completion = kit.generateText({
                PALM_KEY: kit.secrets(["PALM_KEY"]),
              });

              const validator = nursery.validateJson({ schema });

              const agechecker = kit.runJavascript("checker", {
                code: checker.toString(),
                raw: true,
              });

              input.wire("text->", completion);

              completion.wire("completion->json", validator);
              input.wire("schema->", validator);
              validator.wire("json->", agechecker);
              input.wire("text->", agechecker);
              agechecker.wire("json->completion", output);

              // Hack so that completion is present among inputs in $error.
              completion.wire("completion->", validator);
              completion.wire("completion->", agechecker);
            })
          )
          .wire(
            "completion->text",
            jsonPrompt.output({
              $id: "analysis",
              schema: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    title: "Graph of people and relationships",
                    description: "JSON object describing the scene",
                  },
                },
                required: ["text"],
              },
            })
          )
      )
  );

export default jsonPrompt;
