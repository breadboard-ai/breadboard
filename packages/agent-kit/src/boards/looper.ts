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
import { Context, LlmContent, userPartsAdder } from "../context.js";
import { gemini } from "@google-labs/gemini-kit";
import { json } from "@google-labs/json-kit";

export type LooperType = NewNodeFactory<
  {
    /**
     * The initial conversation context.
     */
    context?: NewNodeValue;
  },
  {
    /**
     * The final context after the repetitions.
     */
    context: NewNodeValue;
  }
>;

export type LooperPlan = {
  /**
   * Maximum iterations to make. This can be used to create simple
   * "repeat N times" loops.
   */
  max?: number;
  /**
   * Plan items. Each item represents one trip down the "Loop" output, and
   * at the end of the list, the "Context Out".
   */
  todo?: {
    task: string;
  }[];
  /**
   * Whether to append only the last item in the loop to the context or all
   * of them.
   */
  appendLast?: boolean;
  /**
   * Whether to return only last item from the context as the final product
   * or all of them;
   */
  returnLast?: boolean;
};

export const planSchema = {
  type: "object",
  properties: {
    max: {
      type: "number",
      description: "Maximum iterations to make, optional. Default is infinity",
    },
    todo: {
      type: "array",
      description:
        "Items in the plan, optional. Use this if the plan contains a definite, concrete list of items",
      items: {
        type: "object",
        description: "The object that represent an item in the plan",
        properties: {
          task: {
            type: "string",
            description:
              "The task description. Use action-oriented language, starting with a verb that fits the task",
          },
        },
      },
    },
  },
} satisfies Schema;

const plannerInstruction = {
  parts: [
    {
      text: `You are a talented planner. Given any job, you can create a plan for it. Depending on the job, this plan you produce may be as simple as "repeat N times" or it could be a list of todo items for concrete tasks to perform.

Your output must be a valid JSON of the following format:

\`\`\`json
{
  "max": "number, optional. Specifies how many iterations to make. Useful when the job specifies the upper limit the number of items in the list.",
  "todo": [{
    "task": "string, The task description. Use action-oriented language, starting with a verb that fits the task"
  }]
}
\`\`\``,
    },
  ],
} satisfies LlmContent;

const contextExample = JSON.stringify({
  parts: [{ text: "test" }],
  role: "user",
});

export type LooperData = {
  type: "looper";
  data: LooperPlan;
};

const progressReader = code(({ context }) => {
  const existing = (Array.isArray(context) ? context : [context]) as Context[];
  const progress: LooperPlan[] = [];
  // Collect all metadata entries in the context.
  // Gives us where we've been and where we're going.
  for (let i = existing.length - 1; i >= 0; i--) {
    const item = existing[i];
    if (item.role === "$metadata") {
      progress.push(item.data as LooperPlan);
    }
  }
  if (progress.length) {
    return { progress };
  } else {
    return { context: context };
  }
});

const planReader = code(({ context, progress }) => {
  const plans = (
    Array.isArray(progress) ? progress : [progress]
  ) as LooperPlan[];
  const existing = (Array.isArray(context) ? context : [context]) as Context[];
  if (!plans || !plans.length) {
    throw new Error("Plan is required for Looper to function.");
  }
  try {
    const current = plans[0];
    const originalPlan = plans[plans.length - 1];
    const max = originalPlan.max || originalPlan.todo?.length || Infinity;
    const contents = structuredClone(existing) as Context[];
    const count = plans.length;
    if (count >= max) {
      return { done: existing };
    }
    if (current.todo && Array.isArray(current.todo)) {
      const next = current.todo?.shift();
      if (!next) {
        return { done: existing };
      }
      contents.push({ role: "$metadata", data: current });
      contents.push({ role: "user", parts: [{ text: next.task }] });
      return { context: contents };
    } else if (max) {
      const count = plans.length;
      if (count >= max) {
        return { done: existing };
      }
      contents.push({ role: "$metadata", data: { type: "looper" } });
      return { context: contents };
    }
    return { done: existing };
  } catch (e) {
    const error = e as Error;
    throw new Error(`Invalid plan, unable to proceed: ${error.message}`);
  }
});

export default await board(({ context, task }) => {
  context
    .title("Context in")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default("[]")
    .examples(contextExample)
    .description("The source material for this worker.");

  task
    .title("Task")
    .description("The task from which to create the plan for looping.")
    .isObject()
    .behavior("llm-content");

  // plan
  //   .title("Plan")
  //   .description("What to iterate over, and/or how many times")
  //   .isObject()
  //   .optional()
  //   .default(defaultPlan)
  //   .examples(examplePlan);

  const readProgress = progressReader({
    $metadata: { title: "Read progress so far" },
    context,
  });

  const addTask = userPartsAdder({
    $metadata: { title: "Add Task" },
    context: readProgress.context,
    toAdd: task,
  });

  const generatePlan = gemini.text({
    $metadata: { title: "Generating Plan" },
    context: addTask.context,
    systemInstruction: plannerInstruction,
    responseMimeType: "application/json",
  });

  const validate = json.validateJson({
    $metadata: {
      title: "Validate Plan",
      description: "Validating JSON of the Plan",
    },
    json: generatePlan.text.isString(),
    schema: planSchema,
  });

  const readPlan = planReader({
    $metadata: { title: "Read Plan" },
    context,
    progress: readProgress.progress,
  });

  validate.json.as("progress").to(readPlan);

  base.output({
    $metadata: { title: "Exit" },
    done: readPlan.done.isArray().behavior("llm-content").title("Context Out"),
  });

  return {
    loop: readPlan.context.isArray().behavior("llm-content").title("Loop"),
  };
}).serialize({
  title: "Looper",
  metadata: {
    icon: "laps",
  },
  description:
    "A worker whose job it is to repeat the same thing over and over, until some condition is met or the max count of repetitions is reached.",
  version: "0.0.1",
});
