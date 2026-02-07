/**
 * @fileoverview Provides an output helper.
 */

import {
  LLMContent,
  OutputValues,
  Schema,
  WorkItem,
} from "@breadboard-ai/types";
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
  };

  const { appScreen, consoleEntry } = getCurrentStepState(moduleArgs);
  const outputId = crypto.randomUUID();

  // Add to app screen outputs directly
  appScreen?.outputs.set(outputId, {
    schema,
    output: { details } as OutputValues,
  });

  // Add to console entry as a work item
  if (consoleEntry) {
    const product: WorkItem["product"] = new Map();
    if (typeof details === "string") {
      product.set("details", { parts: [{ text: details }] });
    } else {
      product.set("details", details);
    }
    consoleEntry.work.set(outputId, {
      title: `${title}: ${description}`,
      icon,
      start: 0,
      end: 0,
      elapsed: 0,
      awaitingUserInput: false,
      product,
    });
  }
}
