/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  input,
  jsonSchema,
  output,
  outputNode,
  rawInput,
  type Value,
} from "@breadboard-ai/build";
import { type Schema } from "@google-labs/breadboard";
import { code } from "@google-labs/core-kit";
import {
  addUserParts,
  type Context,
  contextType,
  type LlmContent,
} from "../context.js";

export type HumanMode = "input" | "inputOutput" | "choose" | "chooseReject";

const context = input({
  title: "Context in",
  description: "Incoming conversation context",
  type: array(contextType),
  default: [],
});

const title = input({
  title: "Title",
  description: "The user label",
  type: annotate("string", { behavior: ["config"] }),
  default: "User",
});

const description = input({
  title: "Description",
  description: "The user's input",
  type: annotate("string", { behavior: ["config"] }),
  default: "A request or response",
});

const areWeDoneChecker = code(
  {
    $id: "areWeDoneChecker",
    $metadata: {
      title: "Done Check",
      description: "Checking to see if we can skip work altogether",
    },
    context,
  },
  { context: array(contextType), done: array(contextType) },
  ({ context }) => {
    if (!context) throw new Error("Context is required");
    // are there any done:true in the context?
    let done = false;
    for (let i = 0; i < context.length; ++i) {
      const item = context[i];
      if (item.role === "$metadata" && item.type === "looper") {
        const plan = item.data;
        if (plan.done) {
          done = true;
          break;
        }
      }
    }
    // TODO(aomarks) Casts required until code() supports polymorphism better.
    type TempUnsafeResult = { done: Context[]; context: Context[] };
    if (done) {
      return { done: context } as TempUnsafeResult;
    } else {
      return { context } as TempUnsafeResult;
    }
  }
);

const doneOutput = outputNode(
  { context: output(areWeDoneChecker.outputs.done, { title: "Context out" }) },
  {
    id: "doneOutput",
    title: "Done",
    description: "Skipping because we're done",
  }
);

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
export const routeByMode = code(
  {
    $id: "routeByMode",
    $metadata: {
      title: "Compute Mode",
      description: "Determining the mode of operation",
    },
    context: areWeDoneChecker.outputs.context,
  },
  {
    input: array(contextType),
    output: array(contextType),
    choose: array(contextType),
  },
  ({ context }) => {
    // TODO(aomarks) Casts required until code() supports polymorphism better.
    type TempUnsafeResult = {
      input: Context[];
      output: Context[];
      choose: Context[];
    };
    if (!context) {
      return { input: [] } as object as TempUnsafeResult;
    }
    const c = asContextArray(context);
    const mode = computeMode(c);
    if (mode === "input") {
      return { input: c } as TempUnsafeResult;
    } else if (mode === "inputOutput") {
      return { input: c, output: c } as TempUnsafeResult;
    }
    return { output: onlyChoices(c), choose: c } as TempUnsafeResult;

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

const createSchema = code(
  {
    $id: "createSchema",
    $metadata: {
      title: "Create Schema",
      description: "Creating a schema for user input",
    },
    title,
    description,
    context: routeByMode.outputs.input,
  },
  { schema: jsonSchema },
  ({ title, description }) => {
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
    };
    return { schema };
  }
);

export const buildChooseSchema = code(
  {
    $id: "buildChooseSchema",
    $metadata: {
      title: "Choose Options",
      description: "Creating the options to choose from",
    },
    title,
    description,
    context: routeByMode.outputs.choose,
  },
  { total: "number", schema: jsonSchema },
  ({ context, title, description }) => {
    const c = asContextArray(context).reverse();
    const choices = [];
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
          title,
          description,
          type: "string",
          enum: choices,
        },
      },
    };
    return { schema, total: choices.length };

    function asContextArray(context: Context | Context[]): Context[] {
      return Array.isArray(context) ? context : [context];
    }
  }
);

const chooseInput = rawInput({
  $id: "chooseInput",
  $metadata: {
    title: "Look at the choices above and pick one",
    description: "Asking user to choose an option",
  },
  schema: buildChooseSchema.outputs.schema,
});

export const pickChoice = code(
  {
    $id: "pickChoice",
    $metadata: {
      title: "Read Choice",
      description: "Reading the user's choice",
    },
    context: routeByMode.outputs.choose,
    choice: chooseInput.unsafeOutput("choice") as Value<string>,
    total: buildChooseSchema.outputs.total,
  },
  { context: array(contextType) },
  ({ context, choice, total }) => {
    const chosenIndex = total - parseInt(choice.split(" ")[1], 10);
    const c = context.reverse();
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
  }
);

const choiceOutput = outputNode(
  { context: output(pickChoice.outputs.context, { title: "Context out" }) },
  {
    id: "choiceOutput",
    title: "Choice Output",
    description: "Outputting the user's choice",
  }
);

const displayOutput = outputNode(
  {
    output: output(routeByMode.outputs.output, {
      title: "Output",
      description: "The output to display",
    }),
  },
  {
    id: "output",
    title: "Output",
    description: "Displaying the output to the user.",
    bubble: true,
  }
);

const userInput = rawInput({
  $id: "input",
  $metadata: { title: "Input", description: "Asking user for input" },
  schema: createSchema.outputs.schema,
});

const appendContext = code(
  {
    $id: "appendContext",
    $metadata: {
      title: "Append Context",
      description: "Appending user input to the conversation context",
    },
    context: routeByMode.outputs.input,
    toAdd: userInput.unsafeOutput("text") as Value<LlmContent>,
  },
  { context: array(contextType) },
  addUserParts
);

const contextOutput = outputNode({
  context: output(appendContext.outputs.context, { title: "Context out" }),
  text: output(userInput.unsafeOutput("text") as Value<LlmContent>, {
    id: "contextOutput",
    deprecated: true,
  }),
});

export default board({
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
  inputs: { context, title, description },
  outputs: [doneOutput, displayOutput, contextOutput, choiceOutput],
});
