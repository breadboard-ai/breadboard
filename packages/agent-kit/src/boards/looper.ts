/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  converge,
  enumeration,
  input,
  inputNode,
  output,
  outputNode,
  type Value,
} from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";
import gemini from "@google-labs/gemini-kit";
import { jsonKit } from "@google-labs/json-kit";
import {
  addUserParts,
  type Context,
  contextType,
  llmContentType,
  LooperPlan,
  looperPlanType,
  readProgress,
} from "../context.js";
import { Schema } from "@google-labs/breadboard";
import { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";

const context = input({
  title: "Context in",
  type: array(contextType),
  description: "Incoming conversation context",
  default: [],
});

const task = input({
  title: "Task",
  type: annotate(llmContentType, { behavior: ["config"] }),
  description: "The task to be used for loop planning",
  default: { parts: [] },
});

const model = input({
  title: "Model",
  description: "Choose the model to use for this looper.",
  type: annotate(
    enumeration(
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash-thinking-exp",
      "gemini-exp-1206",
      "gemini-exp-1121",
      "learnlm-1.5-pro-experimental",
      "gemini-1.5-pro-exp-0801",
      "gemini-1.5-pro-exp-0827",
      "gemini-1.5-flash-8b-exp-0827",
      "gemini-1.5-flash-exp-0827"
    ),
    { behavior: ["config"] }
  ),
  default: "gemini-1.5-flash-latest",
  examples: ["gemini-1.5-flash-latest"],
});

const progressReader = code(
  {
    $id: "progressReader",
    $metadata: { title: "Read progress so far" },
    context,
    forkOutputs: true,
  },
  {
    progress: array(looperPlanType),
    context: array(contextType),
  },
  readProgress
);

const taskAdder = code(
  {
    $id: "taskAdder",
    $metadata: { title: "Add Task" },
    context: progressReader.outputs.context,
    toAdd: task,
  },
  { context: array(contextType) },
  addUserParts
);

const plannerInstruction = `
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

`;

const planGenerator = gemini.text({
  $id: "planGenerator",
  $metadata: { title: "Generating Plan" },
  context: taskAdder.outputs.context,
  systemInstruction: plannerInstruction,
  responseMimeType: "application/json",
  model,
});

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

const planValidator = jsonKit.validateJson({
  $id: "validateJson",
  $metadata: { title: "Validate Plan" },
  // TODO(aomarks) Cast because gemini's text output is possibly undefined,
  // because in the tool-calling case no text is returned. Our type system is
  // not smart enough to understand this at compile time (though either it
  // should be, or gemini.text should not be polymorphic).
  json: planGenerator.outputs.text as Value<string>,
  schema: planSchema,
});

// Exported for testing
export const planReaderFunction = ({
  context,
  progress,
}: {
  context: Context | Context[];
  // TODO(aomarks) Wouldn't need this broad type and the cast if validateJson
  // propagated the given type/schema (like the cast node does).
  progress: JsonSerializable;
}): { context: Context[]; done: Context[] } => {
  const plans = (
    Array.isArray(progress) ? progress : [progress]
  ) as LooperPlan[];
  const existing = Array.isArray(context) ? context : [context];
  if (!plans || !plans.length) {
    throw new Error("Plan is required for Looper to function.");
  }
  try {
    const current = plans[0];
    if (current.done) {
      // TODO(aomarks) Here and below, the cast is because we don't support
      // polymorphism in the code helper yet.
      return { done: existing } as { context: Context[]; done: Context[] };
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
    const contents = structuredClone(existing);
    const count = plans.length;
    if (count >= max) {
      return { done: existing } as { context: Context[]; done: Context[] };
    }
    if (current.todo && Array.isArray(current.todo)) {
      const next = current.todo?.shift();
      if (!next) {
        return { done: existing } as { context: Context[]; done: Context[] };
      }
      // Sometimes, the Planner gets confused and puts the
      // doneMaker together with todo.
      // Quietly fix that problem here by removing doneMarker.
      delete current.doneMarker;
      contents.push({
        role: "$metadata",
        type: "looper",
        data: { ...current, next: next.task },
      });
      return { context: contents } as { context: Context[]; done: Context[] };
    } else if (doneMarker) {
      contents.push({
        role: "$metadata",
        type: "looper",
        data: { doneMarker },
      });
      return { context: contents } as { context: Context[]; done: Context[] };
    } else if (max) {
      const count = plans.length;
      if (count >= max) {
        return { done: existing } as { context: Context[]; done: Context[] };
      }
      contents.push({
        role: "$metadata",
        type: "looper",
        data: { max },
      });
      return { context: contents } as { context: Context[]; done: Context[] };
    }
    return { done: existing } as { context: Context[]; done: Context[] };
  } catch (e) {
    const error = e as Error;
    throw new Error(`Invalid plan, unable to proceed: ${error.message}`);
  }
};

const planReader = code(
  {
    $id: "planReader",
    $metadata: { title: "Read Plan" },
    context,
    progress: converge(
      progressReader.outputs.progress,
      planValidator.outputs.json
    ),
  },
  { context: array(contextType), done: array(contextType) },
  planReaderFunction
);

/**
 * Given a context, removes all metadata from it
 */
const cleaner = code(
  {
    $id: "cleanUp",
    $metadata: { title: "Clean up" },
    context: planReader.outputs.done,
  },
  { context: array(contextType) },
  ({ context }) => {
    if (!context) throw new Error("Context is required");
    return { context: context.filter((item) => item.role !== "$metadata") };
  }
);

export default board({
  title: "Looper",
  metadata: {
    icon: "laps",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#looper",
    },
  },
  description:
    "A worker whose job it is to repeat the same thing over and over, until some condition is met or the max count of repetitions is reached.",
  version: "0.0.1",
  inputs: [
    inputNode({ context, task }, { id: "input-1" }),
    inputNode({ model }, { title: "Model Input", id: "modelInput" }),
  ],
  outputs: [
    outputNode(
      { done: output(cleaner.outputs.context, { title: "Done" }) },
      { title: "Exit", id: "exitOutput" }
    ),
    outputNode(
      { loop: output(planReader.outputs.context, { title: "Loop" }) },
      { id: "output-2" }
    ),
  ],
});
