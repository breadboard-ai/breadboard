/**
 * @fileoverview Provides an output helper.
 */

import { LLMContent, OutputResponse, Schema } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { getCurrentStepState } from "../agent/progress-work-item.js";

type ReportInputs = {
  /**
   * The name of the actor providing the report
   */
  actor: string;
  /**
   * The general category of the report
   */
  category: string;
  /**
   * The name of the report
   */
  name: string;
  /**
   * The details of the report
   */
  details: string | LLMContent;
  /**
   * The icon to use
   */
  icon?: string;
  /**
   * Whether or not this is part of interacting
   * with the user
   */
  chat?: boolean;
};

export { report };

function report(moduleArgs: A2ModuleArgs, inputs: ReportInputs): void {
  const { actor: title, category: description, name, details, icon } = inputs;

  const detailsSchema: Schema =
    typeof details === "string"
      ? {
          title: name,
          type: "string",
          format: "markdown",
        }
      : {
          title: name,
          type: "object",
          behavior: ["llm-content"],
        };

  if (icon) {
    detailsSchema.icon = icon;
  }

  const schema: Schema = {
    type: "object",
    properties: {
      details: detailsSchema,
    },
    behavior: ["bubble"],
  };

  const { appScreen, consoleEntry } = getCurrentStepState(moduleArgs);

  const data: OutputResponse = {
    node: {
      id: "output-from-report",
      type: "output",
      configuration: { schema },
      metadata: { title, description, icon },
    },
    outputs: { details } as OutputResponse["outputs"],
    // Random index: no real invocation index exists since we bypass graph
    // traversal. Used by idFromIndex() as a unique map key.
    index: crypto.randomUUID(),
    bubbled: true,
    timestamp: performance.now(),
  };

  appScreen?.addOutput(data);
  consoleEntry?.addOutput(data);
}
