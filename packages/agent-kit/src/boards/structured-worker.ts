/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  constant,
  converge,
  input,
  inputNode,
  jsonSchema,
  loopback,
  output,
  outputNode,
  string,
  Value,
} from "@breadboard-ai/build";
import { code, passthrough } from "@google-labs/core-kit";
import geminiKit from "@google-labs/gemini-kit";
import { jsonKit } from "@google-labs/json-kit";
import { promptTemplate } from "@google-labs/template-kit";
import { type Context, contextType } from "../context.js";
import { OutputPort } from "@breadboard-ai/build/internal/common/port.js";

const context = input({
  title: "Context",
  type: array(contextType),
  default: [],
  examples: [[{ role: "user", parts: [{ text: "the universe within us" }] }]],
});

const instruction = input({
  title: "Instruction",
  type: annotate(string({ format: "multiline" }), { behavior: ["config"] }),
  examples: [
    `You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up three two-line rhyming poems about it.
Look at the topic below and do your magic`,
  ],
});

const schema = input({
  title: "Schema",
  description: "The schema to convert to schemish.",
  type: annotate(jsonSchema, { behavior: ["config"] }),
  default: {},
  examples: [
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
    },
  ],
});

const schemish = jsonKit.schemish({
  $id: "schemish",
  $metadata: {
    title: "Schemish",
    description: "Converting JSON schema to a more compact format",
  },
  schema,
});

const format = promptTemplate({
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
  schemish: schemish.outputs.schemish,
});

const buildContext = code(
  {
    $id: "buildContext",
    $metadata: {
      title: "Build Context",
      description: "Building the context for the agent",
    },
    context,
    instruction,
    format,
  },
  { context: array(contextType) },
  ({ context, format, instruction }) => {
    if (!Array.isArray(context)) {
      // A clever trick. Let's see if this works
      // A user can supply context as either ContextItem[] or as non-array.
      // When it's not an array, let's just conjure up the proper ContextItem[]
      // from that.
      const text =
        typeof context === "string" ? context : JSON.stringify(context);
      context = [{ role: "user", parts: [{ text }] }];
    }
    const list = context || [];
    if (list.length > 0) {
      const last = list[list.length - 1];
      if (last.role === "user") {
        // A trick: the instruction typically sits in front of the actual task
        // that the user requests. So do just that -- add it at the front of the
        // user part list, rather than at the end.
        last.parts.unshift({ text: instruction }, { text: format });
        return { context: list };
      }
    }
    return {
      context: [
        ...list,
        { role: "user", parts: [{ text: instruction }, { text: format }] },
      ],
    } as const;
  }
);

const initialValues = passthrough({
  $id: "initialValues",
  $metadata: {
    title: "Initial Values",
    description: "Populating initial values for the counter",
  },
  count: 5,
  error: "stub",
});

const countLoopback = loopback({ type: "number" });
const errorLoopback = loopback({ type: "unknown" });

const count = code(
  {
    $id: "count",
    $metadata: {
      title: "Counter",
      description: "Counting the JSON healing iteration",
    },
    count: converge(
      // TODO(aomarks) Casts required because we probably want a helper for
      // passthrough that preserves types better.
      initialValues.outputs.count as OutputPort<number>,
      countLoopback
    ),
    error: converge(
      initialValues.outputs.error as OutputPort<string>,
      errorLoopback
    ),
    context: constant(buildContext.outputs.context),
  },
  { continue: array(contextType), count: "number", stop: "string" },
  ({ context, error, count }) => {
    // TODO(aomarks) Casts required until code() supports polymorphism better.
    type TempUnsafeResult = {
      continue: Context[];
      count: number;
      stop: string;
    };
    const num = count - 1;
    if (num != 0) {
      return { continue: context, count: num } as TempUnsafeResult;
    }
    return { stop: error } as TempUnsafeResult;
  }
);
countLoopback.resolve(count.outputs.count);

const generate = geminiKit.text({
  $id: "generate",
  $metadata: {
    title: "Generate",
    logLevel: "info",
    description: "Generating an answer",
  },
  context: count.outputs.continue,
  text: "unused", // A gross hack (see TODO in gemini-generator.ts)
});

const validate = jsonKit.validateJson({
  $id: "validate",
  $metadata: {
    title: "Validate JSON",
    logLevel: "info",
    description: "Checking my work",
  },
  // TODO(aomarks) Cast is required because of the polymorphic signature of
  // gemini text.
  json: generate.outputs.text as Value<string>,
  schema: constant(schema),
});
errorLoopback.resolve(validate.outputs.$error);

const assembleContext = code(
  {
    $id: "assembleContext",
    $metadata: {
      title: "Assemble Context",
      description: "Assembling the context for the agent",
    },
    context: buildContext.outputs.context,
    json: validate.outputs.json,
  },
  { context: array(contextType) },
  ({ context, json }) => {
    if (!context) throw new Error("Context is required");
    return {
      context: [
        ...context,
        { role: "model", parts: [{ text: JSON.stringify(json) }] },
      ] as const,
    };
  }
);

export default board({
  title: "Structured Worker",
  description: "A worker who outputs structure data (JSON) provided a schema.",
  version: "0.0.1",
  metadata: {
    deprecated: true,
  },
  inputs: inputNode({ context, instruction, schema }),
  outputs: [
    outputNode(
      {
        $error: validate.outputs.$error,
        context: count.outputs.stop,
      },
      {
        id: "errorOutput",
        title: "Error Output",
        description: "Displaying error output, giving up on JSON healing",
      }
    ),
    outputNode({
      json: output(validate.outputs.json, {
        title: "JSON",
        description: "The validated JSON.",
      }),
      context: assembleContext.outputs.context,
    }),
  ],
});
