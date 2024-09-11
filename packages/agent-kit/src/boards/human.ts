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
import {
  Context,
  skipIfDone,
  userPartsAdder,
  fun,
  LlmContent,
} from "../context.js";
import { AbstractValue } from "../../../breadboard/dist/src/new/grammar/types.js";

export type HumanType = NewNodeFactory<
  {
    context: NewNodeValue;
    title?: NewNodeValue;
    description?: NewNodeValue;
  },
  {
    context: NewNodeValue;
    again: NewNodeValue;
    text: NewNodeValue;
  }
>;

type SchemaInputs = {
  title: string;
  action: Action;
  description: string;
  context: unknown;
};
type SchemaOutputs = { schema: unknown };

/**
 * The action information to be presented to the user.
 */
export type Action =
  | undefined
  | {
      action: "none";
    }
  | {
      action: "vote";
      title: string;
    };

/**
 * Creates custom input schema.
 */
const inputSchemaBuilder = code<SchemaInputs, SchemaOutputs>(
  ({ title, action, description, context }) => {
    const text: Schema = {
      title,
      description,
      type: "object",
      behavior: ["transient", "llm-content"],
      examples: [JSON.stringify({ parts: [{ text: "" }] })],
    };
    const schema: Schema = {
      type: "object",
      properties: { text },
    } satisfies Schema;

    if (action?.action == "vote") {
      text.title = action.title;
      text.enum = ["Yes", "No"];
    }

    return { schema, context };
  }
);

export type ModeRouterIn = {
  context: unknown;
};
export type ModeRouterOut =
  | {
      input: Context[];
    }
  | {
      input: Context[];
      output: Context[];
    }
  | {
      output: Context[];
      choose: Context[];
    };

export type HumanMode = "input" | "inputOutput" | "choose" | "chooseReject";

/**
 * Four modes:
 * - "input" -- there is no pending model output to show, so we just
 *  show the user input.
 * - "inputOutput" -- there is a model output to show, so we show it
 * first, then ask for user input.
 * - "choose" -- the context contains split output metadata, so we
 * show the model output, and a choice-picker for the user and optionally, a
 * text box for the user to provide feedback.
 * - "chooseReject" -- the context contains a split output
 * metadata, so we show the model output, and a choice-picker for the user
 * with an option to reject and try again, and optionally, a text box for the
 * user to provide feedback.
 *
 * Strategies for each mode, a different output:
 * - "input" -- just the context.
 * - "inputOutput" -- just the context.
 * - "choose" -- the context and the `ChoicePicker` data structure.
 */
export const modeRouterFunction = fun<ModeRouterIn, ModeRouterOut>(
  ({ context }) => {
    if (!context) {
      return { input: [] };
    }
    const c = asContextArray(context);
    const mode = computeMode(c);
    if (mode === "input") {
      return { input: c };
    } else if (mode === "inputOutput") {
      return { input: c, output: c };
    }
    return { output: onlyChoices(c), choose: c };

    function asContextArray(context: unknown): Context[] {
      const input = context as Context | Context[];
      return Array.isArray(input) ? input : [input];
    }

    function onlyChoices(context: Context[]): Context[] {
      const choices: Context[] = [];
      const reversed = [...context].reverse();
      for (const item of reversed) {
        choices.push(item);
        if (
          item.role === "$metadata" &&
          item.type === "split" &&
          item.data.type === "start"
        ) {
          break;
        }
      }
      return choices.reverse();
    }

    function computeMode(context: Context[]): HumanMode {
      const lastItem = context[context.length - 1];
      if (!lastItem) {
        return "input";
      }
      if (lastItem.role === "user") {
        return "input";
      }
      if (lastItem.role !== "$metadata") {
        return "inputOutput";
      }
      if (lastItem.type === "split" && lastItem.data.type === "end") {
        const splitId = lastItem.data.id;
        let choiceCounter = 1;
        for (let i = context.length - 2; i >= 0; i--) {
          const item = context[i];
          if (item.role === "$metadata" && item.type === "split") {
            const { id, type } = item.data;
            if (splitId !== id) {
              return "inputOutput";
            }
            if (type === "start") {
              break;
            }
            choiceCounter++;
          }
        }
        if (choiceCounter > 1) {
          return "choose";
        }
      }
      return "inputOutput";
    }
  }
);
const modeRouter = code(modeRouterFunction);

export const chooseSchemaBuilderFunction = fun(
  ({ context, title, description }) => {
    const c = asContextArray(context).reverse();
    const choices: string[] = [];
    for (const item of c) {
      if (item.role === "$metadata" && item.type === "split") {
        const type = item.data.type;
        if (type === "start") {
          break;
        } else {
          choices.push(`Choice ${choices.length + 1}`);
        }
      }
    }
    const schema: Schema = {
      type: "object",
      properties: {
        choice: {
          title: title as string,
          description: description as string,
          type: "string",
          enum: choices,
        },
      },
    };
    return { schema, total: choices.length };

    function asContextArray(context: unknown): Context[] {
      const input = context as Context | Context[];
      return Array.isArray(input) ? input : [input];
    }
  }
);
const chooseSchemaBuilder = code(chooseSchemaBuilderFunction);

export const choicePickerFunction = fun(({ context, choice, total }) => {
  const chosenIndex =
    (total as number) - parseInt((choice as string).split(" ")[1], 10);
  const c = (context as Context[]).reverse();
  const current: Context[] = [];
  let found: "before" | "found" | "after" = "before";
  let chunkIndex = 0;
  let startIndex = 0;
  for (const [i, item] of c.entries()) {
    if (item.role === "$metadata" && item.type === "split") {
      const type = item.data.type;
      if (type === "start") {
        startIndex = i;
        break;
      } else {
        if (chunkIndex === chosenIndex) {
          found = "found";
        } else if (chunkIndex > chosenIndex) {
          found = "after";
        } else {
          found = "before";
        }
        chunkIndex++;
      }
    } else if (found === "found") {
      current.push(item);
    }
  }
  const preamble = c.slice(startIndex + 1).reverse();
  if (!found) {
    throw new Error(`Integrity error: choice "${choice}" not found`);
  }
  return { context: [...preamble, ...current.reverse()] };
});
export const choicePicker = code(choicePickerFunction);

export default await board(({ context, title, description }) => {
  context
    .title("Context in")
    .description("Incoming conversation context")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default("[]");
  title
    .title("Title")
    .description("The user label")
    .optional()
    .behavior("config")
    .default("User");
  description
    .title("Description")
    .description("The user's input")
    .optional()
    .behavior("config")
    .default("A request or response");

  const areWeDoneChecker = skipIfDone({
    $metadata: {
      title: "Done Check",
      description: "Checking to see if we can skip work altogether",
    },
    context,
  });

  base.output({
    $metadata: { title: "Done", description: "Skipping because we're done" },
    context: areWeDoneChecker.done.title("Context out"),
  });

  const routeByMode = modeRouter({
    $metadata: {
      title: "Compute Mode",
      description: "Determining the mode of operation",
    },
    context: areWeDoneChecker.context,
  });

  const createSchema = inputSchemaBuilder({
    $id: "createSchema",
    $metadata: {
      title: "Create Schema",
      description: "Creating a schema for user input",
    },
    title: title.isString(),
    description: description.isString(),
    context: routeByMode.input,
  });

  const buildChooseSchema = chooseSchemaBuilder({
    $metadata: {
      title: "Choose Options",
      description: "Creating the options to choose from",
    },
    title: title.isString(),
    description: description.isString(),
    context: routeByMode.choose,
  });

  const chooseInput = base.input({
    $metadata: {
      title: "Look at the choices above and pick one",
      description: "Asking user to choose an option",
    },
  });

  buildChooseSchema.schema.to(chooseInput);

  const pickChoice = choicePicker({
    $metadata: {
      title: "Read Choice",
      description: "Reading the user's choice",
    },
    context: routeByMode.choose,
    choice: chooseInput.choice,
    total: buildChooseSchema.total,
  });

  base.output({
    $metadata: {
      title: "Choice Output",
      description: "Outputting the user's choice",
    },
    context: pickChoice.context
      .isArray()
      .behavior("llm-content")
      .title("Context out"),
  });

  base.output({
    $id: "output",
    $metadata: {
      title: "Output",
      description: "Displaying the output the user.",
    },
    output: routeByMode.output,
    schema: {
      type: "object",
      behavior: ["bubble"],
      properties: {
        output: {
          title: "Output",
          description: "The output to display",
          type: "array",
          items: {
            type: "object",
            behavior: ["llm-content"],
          },
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

  const appendContext = userPartsAdder({
    $id: "appendContext",
    $metadata: {
      title: "Append Context",
      description: "Appending user input to the conversation context",
    },
    context: routeByMode.input as AbstractValue<Context | Context[]>,
    toAdd: input.text as AbstractValue<LlmContent>,
  });

  return {
    context: appendContext.context
      .isArray()
      .behavior("llm-content")
      .title("Context out"),
    text: input.text.title("Text").behavior("deprecated"),
  };
}).serialize({
  title: "Human",
  metadata: {
    icon: "human",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#human",
    },
  },
  description:
    "A human in the loop. Use this node to insert a real person (user input) into your team of synthetic workers.",
  version: "0.0.1",
});
