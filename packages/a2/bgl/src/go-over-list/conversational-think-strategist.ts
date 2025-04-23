/**
 * @fileoverview Executes think-as-i strategy, but gently redirects off topic user input back on topic.
 */

import { type Strategist, type Plan, type ExecuteStepFunction } from "./types";
import { ok, toLLMContent } from "./a2/utils";
import { report } from "./a2/output";
import { organizerPrompt } from "./organizer-prompt";

import {
  plannerPrompt,
  thinkingPlannerPrompt,
  getPlan,
} from "./conversational-planner-prompt";

export { ConversationalThinkStrategist };

/**
 * How many extra steps beyond original plan do we allow
 * before concluding we are in the weeds and giving up.
 */
const OVERRUN_BUFFER = 10;

class ConversationalThinkStrategist implements Strategist {
  readonly name = "[Alpha] Conversational Think as I go";
  readonly tasks: string[] = [];
  readonly extraPlannerPrompt = `
If the objective calls to organize or summarize results at the end, do not add that as a step.
Instead, set the "organizeResults" property to "true". This will let the organizing agent know
to kick off the organizing task after you're done.

When the objective does not explicitly contain the request to organize or summarize results,
make sure to set the "organizeProperty" to "false". Do not invent new work.

Now think real hard: do you need to organize or summarize results?
`;

  async execute(
    execute: ExecuteStepFunction,
    mutableContext: LLMContent[],
    objective: LLMContent,
    makeList: boolean
  ): Promise<Outcome<LLMContent[]>> {
    const planning = await plannerPrompt(
      mutableContext,
      objective,
      this.extraPlannerPrompt,
      true
    ).invoke();
    if (!ok(planning)) return planning;
    let plan = getPlan(planning.last);
    if (!ok(plan)) return plan;

    const results: LLMContent[] = [];
    let max = plan.todo.length + OVERRUN_BUFFER;
    let organizeResults = false;

    let planDescription = "Here is my starting plan";

    while (--max) {
      const task = plan.todo.at(0);
      if (plan.summarizeResults) {
        organizeResults = true;
      }
      if (!task) break;
      await report({
        actor: "Planner",
        category: "Progress update",
        name: "Thinking",
        icon: "laps",
        details: `

Here's my thinking:

${plan.thinking}
        
${planDescription}:

${plan.todo.map((item) => `1. ${item.label}`).join("\n")}

I will now go over the plan in order, thinking after each step
and adjusting the plan if necessary.`,
      });
      const result = await execute(task);
      if (result) {
        // Add an 'Action' label so it's easier for the planner to tell what's an agent action vs response.
        // Unfortunately every item in the context except for function calls has 'role: user'.
        mutableContext.push(toLLMContent("Action: " + task.task), result);
        console.log("think-strategist", mutableContext);
        results.push(result);
      }
      this.tasks.push(task.task);
      const thinking = await thinkingPlannerPrompt(
        mutableContext,
        objective,
        plan,
        this.tasks,
        this.extraPlannerPrompt
      ).invoke();
      if (!ok(thinking)) return thinking;
      const newPlan = getPlan(thinking.last);
      if (!ok(newPlan)) return newPlan;
      plan = newPlan;
      planDescription = "Here are the remaining steps in the plan";
    }
    if (organizeResults) {
      await report({
        actor: "Planner",
        category: "Organizing work into a report",
        name: "Organizing work report",
        icon: "laps",
        details: `I will now organize all of my work into a report.`,
      });

      const organizing = await organizerPrompt(
        results,
        objective,
        makeList
      ).invoke();
      if (!ok(organizing)) return organizing;

      return [organizing.last];
    }
    return results;
  }
}
