/**
 * @fileoverview Contains the planner prompt for the conversational think as I go.
 */

import { type GeminiSchema, defaultSafetySettings } from "./a2/gemini";
import { GeminiPrompt } from "./a2/gemini-prompt";
import { llm, err } from "./a2/utils";
import { type Plan } from "./types";

export { plannerPrompt, thinkingPlannerPrompt, getPlan };

function preamble(userObjective: string) {
  return llm`You are an adaptive AI agent controller.

Overall Objective: Your primary goal is to guide an agent to achieve the following objective:
<AGENT_INSTRUCTIONS>
${userObjective}
</AGENT_INSTRUCTIONS>
`.asContent();
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
          "Brief reasoning on why these steps are the right steps to fulfill the objective, or why termination is necessary.",
      },
      todo: {
        type: "array",
        description:
          "The list of tasks to perform. If terminating, this is empty.", // Updated description
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
${preamble(JSON.stringify(objective))}

Initial Plan Outline (Guideline Only):
This was the originally intended sequence of actions. Use it as a reference, but do not follow it rigidly if the situation changes.

${JSON.stringify(plan)}

Current Situation:

History: (A summary of steps already completed and their outcomes)

\`\`\`json
${JSON.stringify(context)}
\`\`\`

Your Task:

Based on the Overall Objective, the Initial Plan Outline, the Available Tools, the History, and crucially, the Last Outcome, determine the single best next step for the agent to take right now. Your absolute priority is to make progress towards the objective *while acknowledging the user's input*.

Critical Instructions:

1.  **Evaluate Last Outcome:** Carefully analyze the \`Last Outcome\`.

2.  **Expected Outcome:** If the outcome was expected (e.g., successful tool execution providing needed info, user response directly answering the previous question) and aligns with progressing the Initial Plan Outline, determine the next logical step from that outline or towards the objective.

3.  **Unexpected/User-Driven Outcome:** If the \`Last Outcome\` is unexpected, problematic, reveals new user needs, is off-topic, emotionally charged, evasive, indicates a failure, or otherwise deviates from the expected path:
    * **PRIORITY 1: Address the User Input:**
        * **Acknowledge & Validate:** *Explicitly acknowledge* the user's statement, question, or expressed feeling. Use empathetic phrasing. Examples: "I understand you're asking about X...", "That's an interesting point about Y...", "It sounds like you're concerned about Z...", "Thanks for sharing that perspective on W..." Avoid language that dismisses or ignores their contribution.
        * **Assess Relevance & Safety:** Quickly determine if the user's input relates to the objective, introduces a new constraint, signals discomfort, raises ethical flags, or indicates a desire to stop.
        * **Connect (If Possible):** If the user's point can be briefly and naturally linked back to the overall objective, do so. Example: "...and thinking about Y might actually help us clarify [part of the objective]..."
        * **Empathetically Redirect:** Gently guide the conversation back towards the objective or the next logical step needed to achieve it. Frame it collaboratively. Examples: "...to make sure we achieve [objective], perhaps we could first look at...?", "...I want to make sure I help you with [objective], so could we focus back on...?", "Given our goal of [objective], the next step I think would be helpful is..."
        * **Adapt the Plan:** Based on the user's input, *fundamentally reassess* the next step. Do NOT blindly follow the Initial Plan Outline. Your next action *must* account for what the user just said.
    * **PRIORITY 2: Determine Adaptive Next Step:** Based on the above interaction, decide the *actual* next step. This might be:
        * Asking the user a clarifying question that incorporates their last point.
        * Rephrasing your previous question or request.
        * Using a different tool or strategy better suited to the new situation.
        * Acknowledging an error and proposing a correction.
        * Pausing the plan to address a user concern directly.
        * Deciding *not* to proceed if the user signals discomfort or the topic becomes inappropriate.
        * Ending the interaction politely if the objective is blocked, achieved, or the user wishes to stop.

4.  **Justify (Mandatory for Deviations):** Briefly explain *why* you chose this next step, *especially* if deviating from the original plan due to an unexpected outcome or user input. Explicitly mention how your chosen step acknowledges the user's input and aims to get back on track empathetically.

5.  **Specify Action:** Clearly define the single next action for the agent.
    * **User Interaction:** Provide the *exact text* the agent should say to the user. Otherwise we will confuse the user.
    * **Tool Use:** State the tool name and the precise inputs required, ensuring inputs are updated based on the latest context and user feedback.
    * **Internal Step:** Describe the internal calculation, data processing, or analysis the agent needs to perform.

6. Note when the agent finishes executing, we'll automatically show the results to the user, so there's no need for an explicit 'present' or 'show' step.

Output:
Provide a clear description of the next step the agent should execute now, and a list of good steps to follow after that (generate them assuming the single next step was sucessful).

For example,
\`\`\`json
{
    "summarizeResults": false,
    "thinking": "The user responded with \"hot dog please\" after the introduction. This is nonsensical and off-topic. I should acknowledge their input and try to redirect the conversation back to the original goal.",
    "todo": [
        {
            "label": "Gather Information",
            "task": "Tell the user that while a hotdog sure sounds tasty, I can't offer the user a hotdog. Then ask the user what brand or business they would like to highlight in the post."
        },
        {
            "label": "Generate Post",
            "task": "Use the brand name and description to generate an instagram post."
        }
    ]
}
\`\`\`

Extra instructions:
${extraPlannerPrompt}
`.asContent();

  const contents = [instruction];
  let prompt = new GeminiPrompt({
    body: {
      contents,
      safetySettings: defaultSafetySettings(),
      generationConfig: {
        responseSchema: planSchema(true),
        responseMimeType: "application/json",
      },
    },
  });

  console.log("thinkingPlannerPrompt: ", prompt);
  return prompt;
}

function plannerPrompt(
  context: LLMContent[] | undefined,
  objective: LLMContent,
  extraPlannerPrompt: string,
  organize: boolean
): GeminiPrompt {
  context ??= [];
  const instruction = preamble(JSON.stringify(objective));
  const epilogue = llm`
Extra instructions:
${extraPlannerPrompt}
`.asContent();
  const contents = [...context, instruction, epilogue];
  let prompt = new GeminiPrompt({
    body: {
      contents,
      safetySettings: defaultSafetySettings(),
      generationConfig: {
        responseSchema: planSchema(organize),
        responseMimeType: "application/json",
      },
    },
  });
  console.log("plannerPrompt: ", prompt);
  return prompt;
}
