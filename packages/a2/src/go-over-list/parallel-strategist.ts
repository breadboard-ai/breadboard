/**
 * @fileoverview Executes a parallel strategy.
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { report } from "../a2/output";
import { ok } from "../a2/utils";
import { getPlan, plannerPrompt } from "./planner-prompt";
import { type ExecuteStepFunction, type Strategist } from "./types";

export { ParallelStrategist };

class ParallelStrategist implements Strategist {
  readonly name = "All at once";
  readonly extraPlannerPrompt = `
All tasks in the plan will be executed in any order or all at once, so make sure that the tasks don't depend on each other.
Think carefully: for every task in the list, does any task depend on another task? If so, rethink your list
until all tasks are indepedent`;

  async execute(
    caps: Capabilities,
    execute: ExecuteStepFunction,
    mutableContext: LLMContent[],
    objective: LLMContent
  ): Promise<Outcome<LLMContent[]>> {
    const planning = await plannerPrompt(
      caps,
      mutableContext,
      objective,
      this.extraPlannerPrompt,
      false
    ).invoke();
    if (!ok(planning)) return planning;
    const plan = getPlan(planning.last);
    if (!ok(plan)) return plan;

    await report(caps, {
      actor: "Planner",
      category: `Creating a plan`,
      name: "Here's my list",
      icon: "laps",
      details: `
${plan.todo.map((item) => `- ${item.label}`).join("\n")}

I will now work on all items at the same time.`,
    });
    return (await Promise.all(plan.todo.map(execute))).filter((item) => !!item);
  }
}
