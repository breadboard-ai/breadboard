/**
 * @fileoverview Executes sequential strategy.
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { report } from "../a2/output";
import { ok, toLLMContent } from "../a2/utils";
import { getPlan, plannerPrompt } from "./planner-prompt";
import { type ExecuteStepFunction, type Strategist } from "./types";

export { SequentialStrategist };

class SequentialStrategist implements Strategist {
  readonly name = "Go in order";
  readonly extraPlannerPrompt = `
All tasks in the plan will be executed in sequence, building on each other.`;

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
      category: `Creating a list`,
      name: "Here's my list",
      icon: "laps",
      details: `
${plan.todo.map((item) => `1. ${item.label}`).join("\n")}

I will now go over the list in order.`,
    });

    const results: LLMContent[] = [];
    for (const task of plan.todo) {
      await report(caps, {
        actor: "Worker",
        category: "Working on a list item",
        name: "Item",
        icon: "laps",
        details: `Currently working on:
  
  ${task.task}
  `,
      });
      const result = await execute(task);
      if (result) {
        mutableContext.push(toLLMContent(task.task), result);
        results.push(result);
      }
    }
    return results;
  }
}
