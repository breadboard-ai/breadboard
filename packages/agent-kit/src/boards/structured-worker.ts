/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NewNodeFactory,
  NewNodeValue,
  Schema,
  base,
  board,
  code,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { gemini } from "@google-labs/gemini-kit";
import { json } from "@google-labs/json-kit";
import { templates } from "@google-labs/template-kit";

export type StructuredWorkerType = NewNodeFactory<
  {
    /**
     * The context to use for the worker.
     */
    context?: NewNodeValue;
    /**
     * The instruction we want to give to the worker so that shapes its
     * character and orients it a bit toward the task we want to give it.
     */
    instruction: NewNodeValue;
    /**
     * The JSON schema to use for the worker.
     */
    schema?: NewNodeValue;
  },
  {
    /**
     * The context after generation. Pass this to the next agent when chaining
     * them together.
     */
    context: NewNodeValue;
    /**
     * The output from the agent. Use this to just get the output without any
     * previous context.
     */
    json: NewNodeValue;
  }
>;

const sampleSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      poems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            inspiration: {
              type: "string",
              description: "The inspiration behind the poem",
            },
            poem: {
              type: "string",
              description: "The poem itself",
            },
          },
        },
      },
    },
  } satisfies Schema,
  null,
  2
);

const sampleInstruction = `You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up three two-line rhyming poems about it.
Look at the topic below and do your magic`;

const sampleContext = `the universe within us`;

type ContextItem = {
  role: string;
  parts: { text: string }[];
};

const contextAssembler = code(({ context, json }) => {
  if (!context) throw new Error("Context is required");
  return {
    context: [
      ...(context as ContextItem[]),
      { role: "model", parts: { text: JSON.stringify(json) } },
    ],
  };
});

const contextBuilder = code(({ context, format, instruction }) => {
  if (!Array.isArray(context)) {
    // A clever trick. Let's see if this works
    // A user can supply context as either ContextItem[] or as non-array.
    // When it's not an array, let's just conjure up the proper ContextItem[]
    // from that.
    const text =
      typeof context === "string" ? context : JSON.stringify(context);
    context = [{ role: "user", parts: [{ text }] }];
  }
  const list = (context as unknown[]) || [];
  if (list.length > 0) {
    const last = list[list.length - 1] as ContextItem;
    if (last.role === "user") {
      // A trick: the instruction typically sits in front of the actual task
      // that the user requests. So do just that -- add it at the front of the
      // user part list, rather than at the end.
      last.parts.unshift(
        { text: instruction as string },
        { text: format as string }
      );
      return { context: list };
    }
  }
  return {
    context: [
      ...list,
      { role: "user", parts: [{ text: instruction }, { text: format }] },
    ],
  };
});

const counter = code(({ context, error, count }) => {
  const num = (count as number) - 1;
  if (num != 0) {
    return { continue: context, count: num };
  }
  return { stop: error };
});

export default await board(({ context, instruction, schema }) => {
  context
    .title("Context")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default("[]")
    .examples(sampleContext);
  instruction
    .title("Instruction")
    .format("multiline")
    .examples(sampleInstruction);
  schema
    .title("Schema")
    .examples(sampleSchema)
    .isObject()
    .format("multiline")
    .optional()
    .default("{}");

  const schemish = json.schemish({
    $id: "schemish",
    $metadata: {
      title: "Schemish",
      description: "Converting JSON schema to a more compact format",
    },
    schema,
  });

  const format = templates.promptTemplate({
    $id: "format",
    $metadata: {
      title: "Reply Structure Formatter",
      description: "Formatting the reply structure for the agent.",
    },
    template: `Reply as valid JSON of the following format:

\`\`\`json
{{schemish}}
\`\`\`
`,
    schemish: schemish,
  });

  const buildContext = contextBuilder({
    $id: "buildContext",
    $metadata: {
      title: "Build Context",
      description: "Building the context for the agent",
    },
    context,
    instruction,
    format: format.prompt,
  });

  const initialValues = core.passthrough({
    $id: "initialValues",
    $metadata: {
      title: "Initial Values",
      description: "Populating initial values for the counter",
    },
    count: 5,
    error: "stub",
  });

  const count = counter({
    $id: "count",
    $metadata: {
      title: "Counter",
      description: "Counting the JSON healing iteration",
    },
    count: initialValues.count,
    error: initialValues.error,
    context: buildContext.context.memoize(),
  });
  count.count.to(count);

  const generate = gemini.text({
    $id: "generate",
    $metadata: {
      title: "Generate",
      logLevel: "info",
      description: "Generating an answer",
    },
    context: count.continue,
    text: "unused", // A gross hack (see TODO in gemini-generator.ts)
  });

  const validate = json.validateJson({
    $id: "validate",
    $metadata: {
      title: "Validate JSON",
      logLevel: "info",
      description: "Checking my work",
    },
    json: generate.text.isString(),
    schema: schema.memoize(),
  });

  validate.$error.as("error").to(count);

  base.output({
    $id: "errorOutput",
    $metadata: {
      title: "Error Output",
      description: "Displaying error output, giving up on JSON healing",
    },
    $error: validate.$error,
    context: count.stop,
  });

  const assembleContext = contextAssembler({
    $id: "assembleContext",
    $metadata: {
      title: "Assemble Context",
      description: "Assembling the context for the agent",
    },
    context: buildContext.context,
    json: validate.json,
  });

  assembleContext.context
    .title("Context")
    .isArray()
    .behavior("llm-content")
    .description("Agent context after generation");
  generate.text.title("Output").isString().description("Agent's output");

  return { context: assembleContext.context, json: validate.json };
}).serialize({
  title: "Structured Worker",
  description: "A worker who outputs structure data (JSON) provided a schema.",
  version: "0.0.1",
});
