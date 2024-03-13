/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Schema,
  base,
  code,
  board,
  NewNodeFactory,
  NewNodeValue,
} from "@google-labs/breadboard";

export type HumanType = NewNodeFactory<
  {
    context: NewNodeValue;
    title?: NewNodeValue;
    description?: NewNodeValue;
  },
  {
    context: NewNodeValue;
    text: NewNodeValue;
  }
>;

type SchemaInputs = { title: string; description: string; context: unknown };
type SchemaOutputs = { schema: unknown };

/**
 * Creates custom input schema.
 */
const schema = code<SchemaInputs, SchemaOutputs>(
  ({ title, description, context }) => {
    const schema = {
      type: "object",
      properties: {
        text: {
          title,
          description,
          behavior: ["transient"],
        },
      },
    } satisfies Schema;

    return { schema, context };
  }
);

type AppenderInputs = { context: unknown[]; text: string };
type AppenderOutputs = { context: unknown[] };

/**
 * Appends user input to the context of the conversation.
 */
export const contextAppender = code<AppenderInputs, AppenderOutputs>(
  ({ context, text }) => {
    return {
      context: [...(context || []), { role: "user", parts: [{ text }] }],
    };
  }
);

const maybeOutput = code(({ context }) => {
  if (Array.isArray(context) && context.length > 0) {
    const lastItem = context[context.length - 1];
    if (lastItem.role === "model") {
      const output = lastItem.parts
        .map((item: { text: string }) => item.text)
        .join("/n");
      return { output, context };
    }
  }
  return { context };
});

export default await board(({ context, title, description }) => {
  context
    .title("Context")
    .description("Incoming conversation context")
    .isArray()
    .behavior("llm-content")
    .optional()
    .examples(JSON.stringify([]))
    .default("[]");
  title
    .title("Title")
    .description("The title to ask")
    .optional()
    .default("User");
  description
    .title("Description")
    .description("The description of what to ask")
    .optional()
    .default("User's question or request");

  const maybeOutputRouter = maybeOutput({
    $id: "maybeOutputRouter",
    $metadata: {
      title: "Maybe Output",
      description: "Checking if the last message was from the model",
    },
    context,
  });

  const createSchema = schema({
    $id: "createSchema",
    $metadata: {
      title: "Create Schema",
      description: "Creating a schema for user input",
    },
    title: title.isString(),
    description: description.isString(),
    context: maybeOutputRouter.context,
  });

  base.output({
    $id: "output",
    $metadata: {
      title: "Output",
      description: "Displaying the output the user.",
    },
    output: maybeOutputRouter.output,
    schema: {
      type: "object",
      behavior: ["bubble"],
      properties: {
        output: {
          type: "string",
          title: "Output",
          description: "The output to display",
        },
      },
    } satisfies Schema,
  });

  const input = base.input({
    $id: "input",
    $metadata: {
      title: "Input",
      description: "Asking user for input",
    },
  });

  createSchema.schema.to(input);

  const appendContext = contextAppender({
    $id: "appendContext",
    $metadata: {
      title: "Append Context",
      description: "Appending user input to the conversation context",
    },
    context: createSchema.context.isArray(),
    text: input.text.isString(),
  });

  return {
    context: appendContext.context
      .isArray()
      .behavior("llm-content")
      .title("Context"),
    text: input.text.title("Text"),
  };
}).serialize({
  title: "Human",
  description:
    "A human in the loop. Use this node to insert a real person (user input) into your team of synthetic workers.",
  version: "0.0.1",
});
