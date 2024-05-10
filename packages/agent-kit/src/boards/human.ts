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
import { LlmContent, Context, TextPart, skipIfDone } from "../context.js";

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
type Action =
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
const schema = code<SchemaInputs, SchemaOutputs>(
  ({ title, action, description, context }) => {
    const text: Schema = {
      title,
      description,
      type: "string",
      behavior: ["transient"],
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

type AppenderInputs = { context: unknown[]; text: string };
type AppenderOutputs = { context: unknown[] };

/**
 * Appends user input to the context of the conversation.
 */
export const contextAppender = code<AppenderInputs, AppenderOutputs>(
  ({ context, text }) => {
    if (!text) return { context };
    return {
      context: [...(context || []), { role: "user", parts: [{ text }] }],
    };
  }
);

type WithFeedback = Record<string, unknown> & { voteRequest?: string };

const maybeOutput = code(({ context }) => {
  const action: Action = { action: "none" };
  if (Array.isArray(context) && context.length > 0) {
    let lastItem = context[context.length - 1] as Context;
    if (lastItem.role === "$metadata") {
      lastItem = context[context.length - 2];
    }
    if (lastItem && lastItem.role !== "user") {
      const output = lastItem;
      try {
        if ("parts" in output && "text" in output.parts[0]) {
          const json = output.parts[0]?.text;
          const data = JSON.parse(json) as WithFeedback;
          if (data.voteRequest) {
            const feedback = structuredClone(data);
            delete feedback["voteRequest"];
            const action: Action = { action: "vote", title: data.voteRequest };
            return { feedback, action, context };
          }
        }
      } catch {
        // it's okay to fail here.
      }
      return { output, action, context };
    }
  }
  return { context, action };
});

const actionRecognizer = code(({ text, context, action }) => {
  const a = action as Action;

  if (a?.action === "vote") {
    if (text === "No") {
      // Remove last item. We already know it comes from the model.
      (context as Context[]).pop();
      return { text, again: context };
    }
    // Clip out the `votingRequest`.
    const c = structuredClone(context) as LlmContent[];
    const lastItem = c[c.length - 1];
    const parts = lastItem.parts;
    const t = Array.isArray(parts)
      ? (parts as TextPart[]).map((item) => item.text).join("/n")
      : (parts as TextPart).text;
    const output = t;
    const data = JSON.parse(output) as WithFeedback;
    delete data["voteRequest"];
    lastItem.parts = [{ text: JSON.stringify(data) }];

    // Don't pass text, it's superfluous with the voting action.
    return { text: "", context: c };
  }
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
          parts: [
            {
              text: JSON.stringify(voteRequestContent),
            },
          ],
          role: "model",
        },
      ])
    )
    .default("[]");
  title
    .title("Title")
    .description("The title to ask")
    .optional()
    .behavior("config")
    .default("User");
  description
    .title("Description")
    .description("The description of what to ask")
    .optional()
    .behavior("config")
    .default("User's question or request");

  const maybeOutputRouter = maybeOutput({
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
    context: maybeOutputRouter.context,
  });

  base.output({
    $metadata: { title: "Done", description: "Skipping because we're done" },
    context: areWeDoneChecker.done.title("Context out"),
  });

  const createSchema = schema({
    $id: "createSchema",
    $metadata: {
      title: "Create Schema",
      description: "Creating a schema for user input",
    },
    title: title.isString(),
    description: description.isString(),
    context: areWeDoneChecker.context,
    action: maybeOutputRouter.action,
  });

  base.output({
    $metadata: {
      title: "Feedback",
      description: "Displaying the output to user with feedback",
    },
    feedback: maybeOutputRouter.feedback,
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
    output: maybeOutputRouter.output,
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
    action: maybeOutputRouter.action,
  });

  base.output({
    $metadata: {
      title: "Rejection",
      description: "Rejecting latest agent work per user action",
    },
    again: recognizeAction.again.behavior("deprecated"),
  });

  const appendContext = contextAppender({
    $id: "appendContext",
    $metadata: {
      title: "Append Context",
      description: "Appending user input to the conversation context",
    },
    context: recognizeAction.context.isArray(),
    text: recognizeAction.text.isString(),
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
