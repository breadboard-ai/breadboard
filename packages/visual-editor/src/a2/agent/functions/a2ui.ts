/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types/capabilities.js";
import { SmartLayoutPipeline } from "../a2ui/smart-layout-pipeline.js";
import { FunctionGroup } from "../types.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { AgentFileSystem } from "../file-system.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { LLMContent, Outcome } from "@breadboard-ai/types";
import { AgentUI } from "../ui.js";
import { llm, tr } from "../../a2/utils.js";
import { Params } from "../../a2/common.js";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { mapDefinitions } from "../function-definition.js";

export { getA2UIFunctionGroup };

export type A2UIFunctionArgs = {
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  uiPrompt: LLMContent | undefined;
  objective: LLMContent;
  params: Params;
  ui: AgentUI;
};

const instruction = tr`

## Interacting with the User

To interact with the user, rely on functions that start with "ui_ask_user_". These functions are designed to present consistent user interface to the user, and all you need to do is to choose the right funciton and supply the necessary parameters. Once such a function function is called, it blocks until the user interacts with it, making a selection or entering text. The function then returns back with the outcomes of user's interaction.

`;

async function getA2UIFunctionGroup(
  args: A2UIFunctionArgs
): Promise<Outcome<FunctionGroup>> {
  const { objective, uiPrompt, params, ui } = args;
  const layoutPipeline = new SmartLayoutPipeline(args);
  ui.progress.generatingLayouts(uiPrompt);
  console.time("LAYOUT GENERATION");
  const layouts = await layoutPipeline.prepareFunctionDefinitions(
    llm`${objective}\n\n${uiPrompt || ""}`.asContent(),
    params
  );
  console.timeEnd("LAYOUT GENERATION");
  if (!ok(layouts)) return layouts;
  return { ...mapDefinitions(layouts), instruction };
}
