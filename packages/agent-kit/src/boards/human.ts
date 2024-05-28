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
import { Context, skipIfDone, userPartsAdder, fun } from "../context.js";

const voteRequestContent = {
  adCampaign: {
    headlines: [
      "Breadboard: AI Playground",
      "Exp. AI Patterns",
      "Rapid Prototyping",
      "AI Power, Gemini",
      "Integrate AI Seamlessly",
      "Create Graphs, Prompts",
      "Accessible AI",
      "Breadboard: Dev's AI Kit",
      "Supercharge Dev, Breadboard",
      "Accelerate Innovation",
      "Revolutionize Dev, AI",
      "Breadboard: AI, Ingenuity",
      "Elevate Projects, Breadboard",
      "Unlock AI Power, Breadboard",
    ],
    descriptions: [
      "Breadboard: Play, experiment, prototype with AI. Integrate AI with Gemini.",
      "Stunning graphs with prompts. Accessible AI for devs.",
      "Accelerate innovation with Breadboard. Experiment with AI risk-free.",
      "Elevate projects with Breadboard AI. Integrate AI seamlessly.",
    ],
  },
  voteRequest: "Does this ad campaign seem ok to you?",
};

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
export type ModeRouterOut = {
  context: unknown;
  action: Action;
  output?: Context;
};
/**
 * Four modes:
 * - "input" -- there is no pending model output to show, so we just
 *  show the user input.
 * - "input-output" -- there is a model output to show, so we show it
 * first, then ask for user input.
 * - "choose" -- the context contains a split output metadata, so we
 * show the model output, and a choice-picker for the user and optionally, a
 * text box for the user to provide feedback.
 * - "choose-reject" -- the context contains a split output
 * metadata, so we show the model output, and a choice-picker for the user
 * with an option to reject and try again, and optionally, a text box for the
 * user to provide feedback.
 */
export const modeRouterFunction = fun<ModeRouterIn, ModeRouterOut>(
  ({ context }) => {
    const action: Action = { action: "none" };
    if (Array.isArray(context) && context.length > 0) {
      let lastItem = context[context.length - 1] as Context;
      if (lastItem.role === "$metadata") {
        lastItem = context[context.length - 2];
      }
      if (lastItem && lastItem.role !== "user") {
        const output = lastItem;
        return { output, action, context };
      }
    }
    return { context, action };
  }
);

const modeRouter = code(modeRouterFunction);

const actionRecognizer = code(({ text, context, action }) => {
  return { text, context };
});

export default await board(({ context, title, description }) => {
  context
    .title("Context in")
    .description("Incoming conversation context")
    .isArray()
    .behavior("llm-content")
    .optional()
    .examples(
      JSON.stringify([
        {
          parts: [{ text: JSON.stringify(voteRequestContent) }],
          role: "model",
        },
      ])
    )
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

  const routeByMode = modeRouter({
    $id: "maybeOutputRouter",
    $metadata: {
      title: "Maybe Output",
      description: "Checking if the last message was from the model",
    },
    context,
  });

  const areWeDoneChecker = skipIfDone({
    $metadata: {
      title: "Done Check",
      description: "Checking to see if we can skip work altogether",
    },
    context: routeByMode.context,
  });

  base.output({
    $metadata: { title: "Done", description: "Skipping because we're done" },
    context: areWeDoneChecker.done.title("Context out"),
  });

  const createSchema = inputSchemaBuilder({
    $id: "createSchema",
    $metadata: {
      title: "Create Schema",
      description: "Creating a schema for user input",
    },
    title: title.isString(),
    description: description.isString(),
    context: areWeDoneChecker.context,
    action: routeByMode.action,
  });

  base.output({
    $metadata: {
      title: "Feedback",
      description: "Displaying the output to user with feedback",
    },
    feedback: routeByMode.feedback,
    schema: {
      type: "object",
      behavior: ["bubble"],
      properties: {
        feedback: {
          type: "string",
          title: "Feedback",
          description: "The feedback to display",
        },
      },
    } satisfies Schema,
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
          type: "object",
          behavior: ["llm-content"],
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

  const recognizeAction = actionRecognizer({
    $metadata: {
      title: "Action Recognizer",
      description: "Recognizing the action that user has taken",
    },
    context: createSchema.context,
    text: input.text,
  });

  base.output({
    $metadata: {
      title: "Rejection",
      description: "Rejecting latest agent work per user action",
    },
    again: recognizeAction.again.behavior("deprecated"),
  });

  const appendContext = userPartsAdder({
    $id: "appendContext",
    $metadata: {
      title: "Append Context",
      description: "Appending user input to the conversation context",
    },
    context: recognizeAction.context,
    toAdd: recognizeAction.text,
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
  },
  description:
    "A human in the loop. Use this node to insert a real person (user input) into your team of synthetic workers.",
  version: "0.0.1",
});
