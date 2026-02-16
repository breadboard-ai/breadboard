/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  Outcome,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { Template } from "../a2/template.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { OpalAdkStream, NODE_AGENT_KEY } from "../a2/opal-adk-stream.js";
import { AgentInputs, AgentOutputs, toAgentOutputs } from "./main.js"

export async function invokeAgentAdk(
  {
    config$prompt: prompt_template,
    "b-ui-consistent": enableA2UI = false,
    "b-ui-prompt": uiPrompt,
    ...rest
  }: AgentInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  invocation_id?: string,

): Promise<Outcome<AgentOutputs>> {
  const params = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("p-z-"))
  );
  const opalAdkStream = new OpalAdkStream(caps, moduleArgs);
  const uiType = enableA2UI ? "a2ui" : "chat";
  const template = new Template(prompt_template, moduleArgs.context.currentGraph);
  const completed_prompt = await template.substitute(params);
  if (!ok(completed_prompt)) {
    return completed_prompt;
  }
  console.log("substitutine: ", completed_prompt);
  const results = await opalAdkStream.executeOpalAdkStream(
    NODE_AGENT_KEY,
    [completed_prompt],
    "none",
    uiType,
    uiPrompt,
    invocation_id,
  );
  if (!ok(results)) return results;
  console.log("Node Agent Result: ", results);
  return toAgentOutputs(results);
}