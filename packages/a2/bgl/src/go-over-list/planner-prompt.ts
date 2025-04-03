/**
 * @fileoverview Contains the planner prompt.
 */

import { type GeminiSchema, defaultSafetySettings } from "./a2/gemini";
import { GeminiPrompt } from "./a2/gemini-prompt";
import { llm, err } from "./a2/utils";
import { type Plan } from "./types";

export { plannerPrompt, thinkingPlannerPrompt, getPlan };

function preamble(extraPlannerPrompt: string) {
  return `You are a planner. 
You are to create a precise plan -- a list of tasks -- for a given objective. This plan will be executed by others.

${extraPlannerPrompt}

Your responsibility is to produce a plan that fulfills the objective.

Examine the objective, slow down, take a deep breath.
Now think: how might you break the objective into tasks that, when all completed, will fulfill the objective?
Now write out the tasks. Do not add any superflous tasks.

For each task, also think of a brief label that describes that task and could be used in a UI as a hint to the user.

If multiple tools are mentioned in the objective, make sure to mention them all in the task so that whoever
executes the task can decide which tool to use.
`;
}

function planSchema(organize?: boolean): GeminiSchema {
  const organizeFlag = (
    organize
      ? {
          summarizeResults: {
            type: "boolean",
            description:
              "Set to true if and only if the objective calls for summarizing results at the end. Set to false otherwise.",
          },
        }
      : {}
  ) as Record<string, GeminiSchema>;
  const required = ["thinking", "todo"];
  if (organize) {
    required.push(...Object.keys(organizeFlag));
  }
  return {
    type: "object",
    properties: {
      thinking: {
        type: "string",
        description:
          "Brief reasoning on why these steps are the right steps to fulfill the objective.",
      },
      todo: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description:
                "The task description. Use action-oriented language, starting with a verb that fits the task.",
            },
            label: {
              description: "Short, precise label for that describes the task.",
              type: "string",
            },
          },
          required: ["task", "label"],
        },
      },
      ...organizeFlag,
    },
    required,
  };
}

function getPlan(content: LLMContent): Outcome<Plan> {
  const planPart = content.parts.at(0);
  if (!planPart || !("json" in planPart)) {
    // TODO: Error recovery.
    return err(`Gemini generated invalid plan`);
  }
  console.log("PLAN", planPart.json);
  return planPart.json as Plan;
}

function prependInstruction(text: string, plan: LLMContent): LLMContent {
  return {
    ...plan,
    parts: [...plan.parts, { text }],
  };
}

function thinkingPlannerPrompt(
  context: LLMContent[],
  objective: LLMContent,
  plan: Plan,
  steps: string[],
  extraPlannerPrompt: string
): GeminiPrompt {
  const instruction = llm`
${preamble(extraPlannerPrompt)}

Your objective is:

\`\`\`

${objective}

\`\`\`

Your original plan was:

\`\`\`json
${JSON.stringify(plan)}
\`\`\`

So far, you've completed these steps:

${steps.map((step) => `- ${step}`).join("\n")}

Update the plan to ensure that the steps that follow achieve the objective.
Pay particular attention to steps that did not complete successfully and strategize
different approaches and steps that might be necesssary to complete them.

Only add steps to the plan that still need to be completed.
Do not return completed steps as part of the updated plan.
If no more steps are needed, return no steps.
`.asContent();

  const contents = [...context, instruction];
  return new GeminiPrompt({
    body: {
      contents,
      safetySettings: defaultSafetySettings(),
      generationConfig: {
        responseSchema: planSchema(true),
        responseMimeType: "application/json",
      },
    },
  });
}

function plannerPrompt(
  context: LLMContent[] | undefined,
  objective: LLMContent,
  extraPlannerPrompt: string,
  organize: boolean
): GeminiPrompt {
  context ??= [];
  const instruction = `${preamble(extraPlannerPrompt)}`;

  const contents = [...context, prependInstruction(instruction, objective)];
  return new GeminiPrompt({
    body: {
      contents,
      safetySettings: defaultSafetySettings(),
      generationConfig: {
        responseSchema: planSchema(organize),
        responseMimeType: "application/json",
      },
    },
  });
}
