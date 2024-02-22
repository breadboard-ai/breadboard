/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, base, code, board } from "@google-labs/breadboard";

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

type ContextItem = { role: string; parts: { text: string }[] };

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

const testOutput = [
  {
    role: "model",
    parts: [{ text: "Hello, user!" }],
  },
] as ContextItem[];

export default await board(({ context, title, description }) => {
  context
    .title("Context")
    .description("Incoming conversation context")
    .isObject()
    .optional()
    .examples(JSON.stringify(testOutput))
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
    context,
  });

  const createSchema = schema({
    $id: "createSchema",
    title: title.isString(),
    description: description.isString(),
    context: maybeOutputRouter.context,
  });

  base.output({
    $id: "output",
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
  });

  createSchema.schema.to(input);

  const appendContext = contextAppender({
    $id: "appendContext",
    context: createSchema.context.isArray(),
    text: input.text.isString(),
  });

  return {
    context: appendContext.context.isArray().title("Context"),
    text: input.text.title("Text"),
  };
}).serialize({
  title: "Ask User",
  description: "A building block for the nascent agent framework",
  version: "0.0.1",
});
