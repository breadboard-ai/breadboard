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
import {
  Context,
  LlmContent,
  LooperPlan,
  LooperProgress,
  cleanUpMetadata,
  fun,
  progressReader,
  userPartsAdder,
} from "../context.js";
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
    doneMarker: {
      type: "string",
      description:
        "The marker that will be used by others to signal completion of the job.",
    },
    error: {
      type: "string",
      description: "Describe the reason why the plan generation failed",
    },
  },
} satisfies Schema;

const plannerInstruction = {
  parts: [
    {
      text: `
You are to create a precise plan for a given job. This plan will be executed by others and your responsibility is to produce a plan that reflects the job. 

Your output must be a valid JSON of the following format:

\`\`\`json
{
  "max": "number, optional. Specifies how many iterations to make. Useful when the job specifies the upper limit the number of items in the list.",
  "todo": [{
    "task": "string, The task description. Use action-oriented language, starting with a verb that fits the task."
  }]
  "doneMarker": "string, optional. The marker that will be used by others to signal completion."
  "error": "string, optional. A description of why you're unable to create a plan"
}
\`\`\`

There are four kinds of jobs that you can make plans for. 

1) The indefinite job. These are useful when there is not a definite completion condition, and is usually formulated with words like "indefinitely" or "forever". In such cases, the plan will look like an object without a "todo" property, with "max" set to a very large number:

\`\`\`json
{
  "max": 100000000
}
\`\`\`

2) The step-by-step job. These are for situations when a distinct, known number of tasks can be discerned from the job. For example, when asked to write chapters of a book following an outline, there's a clear list of tasks that can be discerned (one "Write <chapter title>" per chapter). 

A plan for this kind of job will look like an object with "todo" items:

\`\`\`json
{
  "todo": [
    { "task": "<action-oriented description of task 1" },
    { "task": "<action-oriented description of task 2" },
    { "task": "<action-oriented description of task 3" }
  ]
}
\`\`\`\

If the job includes a limit on how many tasks to produce, use the "max" property to indicate that. For instance, if the job contains three items that can be discerned, but asks to only do two of them:

\`\`\`json
{
  "max:" 2,
  "todo": [
    { "task": "<action-oriented description of task 1" },
    { "task": "<action-oriented description of task 2" },
    { "task": "<action-oriented description of task 3" }
  ]
}
\`\`\`

3) Just repeat the steps job. These jobs do not have a distinct tasks, but rather just a number of steps to repeat. In this case, omit the "todo" and just use "max" property:

\`\`\`json
{
  "max": 4
}
\`\`\`

4) The job where the completion is signaled by others. These are the types of jobs where the number of iterations or the exact steps are unknown, and the
completion signal is issued by those who are executing the individual steps. In such cases, use the "doneMarker" property and use the marker specified:

\`\`\`json
{
  "doneMarker": "<the marker that will be used to signal completion>"
}
\`\`\`

Common markers are "##STOP##" or "##DONE##", but could be different depending on a job. This type of the job is mutually exclusive with the step-by-step type, so the "todo" and "doneMarker" may never be specified together.

When you are unable to create plan from the job, reply with:

\`\`\`json
{
  "error": "<description of why you're unable to create a plan>"
}
\`\`\`

`,
    },
  ],
} satisfies LlmContent;

const contextExample = JSON.stringify({
  parts: [{ text: "test" }],
  role: "user",
});

export type LooperData = {
  type: "looper";
  data: LooperProgress;
};

export const planReaderFunction = fun(({ context, progress }) => {
  const plans = (
    Array.isArray(progress) ? progress : [progress]
  ) as LooperPlan[];
  const existing = (Array.isArray(context) ? context : [context]) as Context[];
  if (!plans || !plans.length) {
    throw new Error("Plan is required for Looper to function.");
  }
  try {
    const current = plans[0];
    if (current.done) {
      return { done: existing };
    }
    const originalPlan = plans[plans.length - 1];
    let max = originalPlan.max;
    const doneMarker = originalPlan.doneMarker;
    if (!max) {
      const planItems = originalPlan.todo?.length;
      if (planItems) {
        max = planItems + 1;
      } else {
        max = Infinity;
      }
    }
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
      // Sometimes, the Planner gets confused and puts the
      // doneMaker together with todo.
      // Quietly fix that problem here by removing doneMarker.
      delete current.doneMarker;
      contents.push({
        role: "$metadata",
        data: { ...current, next: next.task },
      });
      return { context: contents };
    } else if (doneMarker) {
      contents.push({
        role: "$metadata",
        data: { type: "looper", doneMarker },
      });
      return { context: contents };
    } else if (max) {
      const count = plans.length;
      if (count >= max) {
        return { done: existing };
      }
      contents.push({ role: "$metadata", data: { type: "looper", max } });
      return { context: contents };
    }
    return { done: existing };
  } catch (e) {
    const error = e as Error;
    throw new Error(`Invalid plan, unable to proceed: ${error.message}`);
  }
});

const planReader = code(planReaderFunction);

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
    .optional()
    .default("{}")
    .description("The task from which to create the plan for looping.")
    .isObject()
    .behavior("llm-content", "config");

  const readProgress = progressReader({
    $metadata: { title: "Read progress so far" },
    context,
    forkOutputs: true,
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

  const cleaner = cleanUpMetadata({
    $metadata: {
      title: "Clean up",
      description: "Cleaning up the metadata that was used for running loops",
    },
    context: readPlan.done,
  });

  base.output({
    $metadata: { title: "Exit" },
    done: cleaner.context
      .isArray()
      .behavior("llm-content")
      .title("Context out"),
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
