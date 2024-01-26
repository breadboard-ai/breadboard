import { Schema, base, code, recipe } from "@google-labs/breadboard";

type SchemaInputs = { title: string; description: string };
type SchemaOutputs = { schema: unknown };

/**
 * Creates custom input schema.
 */
const schema = code<SchemaInputs, SchemaOutputs>(({ title, description }) => {
  const schema = {
    type: "object",
    properties: {
      text: {
        title,
        description,
      },
    },
  } satisfies Schema;

  return { schema };
});

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

export default await recipe(({ context, title, description }) => {
  context
    .title("Context")
    .description("Incoming conversation context")
    .optional()
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
  const createSchema = schema({
    $id: "createSchema",
    title: title.isString(),
    description: description.isString(),
  });

  const input = base.input({
    $id: "input",
  });

  createSchema.schema.to(input);

  const appendContext = contextAppender({
    $id: "appendContext",
    context: context.isArray(),
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
