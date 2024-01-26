/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type NodeValue,
  Board,
  GraphDescriptor,
} from "@google-labs/breadboard";
import { TemplateKit } from "@google-labs/template-kit";

import { PromptMaker } from "./template.js";

import { schemishGenerator } from "./schemish-generator.js";
import { Core } from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";

const BASE = "v2-multi-agent";

const maker = new PromptMaker(BASE);
const board = new Board();
const kit = board.addKit(TemplateKit);
const core = board.addKit(Core);
const json = board.addKit(JSONKit);

const prologuePrompt = kit
  .promptTemplate(
    await maker.prompt("order-agent-prologue", "orderAgentPrologue")
  )
  .wire("<-tools.", core.passthrough(await maker.part("tools", "json")));

const schema = core.passthrough(await maker.jsonPart("order-schema"));

const epiloguePrompt = kit.promptTemplate(
  await maker.prompt("order-agent-epilogue", "orderAgentEpilogue")
);

const customerMemory = core.append({ $id: "customerMemory" });
const agentMemory = core.append({ $id: "agentMemory" });
const toolMemory = core.append({ $id: "toolMemory" });

core.passthrough({ accumulator: "\n" }).wire("accumulator->", customerMemory);
customerMemory.wire("accumulator->", agentMemory);
agentMemory
  .wire("accumulator->", toolMemory)
  .wire("accumulator->", customerMemory);
toolMemory.wire("accumulator->", agentMemory);

epiloguePrompt
  .wire("memory<-accumulator", customerMemory)
  .wire("memory<-accumulator", toolMemory);

const checkMenuTool = core.passthrough().wire(
  "checkMenu->json",
  json.jsonata({ expression: "actionInput" }).wire(
    "result->customer",
    core
      .slot({ slot: "checkMenu" })
      .wire("bot->Tool", toolMemory)
      .wire("bot->", board.output({ $id: "checkMenu-tool-output" }))
      .wire("$error->", board.output({ $id: "error" }))
  )
);

const summarizeMenuTool = core.passthrough().wire(
  "summarizeMenu->json",
  json.jsonata({ expression: "actionInput" }).wire(
    "result->customer",
    core
      .slot({ slot: "summarizeMenu" })
      .wire("bot->Tool", toolMemory)
      .wire("bot->", board.output({ $id: "summarizeMenu-tool-output" }))
      .wire("$error->", board.output({ $id: "error" }))
  )
);

const customerTool = core
  .passthrough()
  .wire(
    "customer->json",
    json
      .jsonata({ expression: "actionInput" })
      .wire(
        "result->message",
        board
          .input({ $id: "ask-customer-tool" })
          .wire("customer->Customer", customerMemory)
      )
  );

const finalizeOrderTool = core
  .passthrough()
  .wire("finalizeOrder->bot", board.output({ $id: "finalizeOrder" }));

function route({ completion }: { completion: NodeValue }) {
  const data = completion as NodeValue & { action: string };
  return { [data.action]: data, tool: data.action };
}

const toolRouter = core
  .runJavascript({
    $id: "toolRouter",
    name: "route",
    code: route.toString(),
    raw: true,
  })
  .wire("tool->bot", board.output({ $id: "selected-tool" }))
  .wire("customer->", customerTool)
  .wire("checkMenu->", checkMenuTool)
  .wire("summarizeMenu->", summarizeMenuTool)
  .wire("finalizeOrder->", finalizeOrderTool);

board
  .input({ $id: "first-ask-customer" })
  .wire("customer->Customer", customerMemory);

core
  .include({ graph: schemishGenerator as GraphDescriptor, $id: "generator" })
  .wire("prologue<-prompt.", prologuePrompt)
  .wire("epilogue<-prompt.", epiloguePrompt)
  .wire("schema<-order-schema.", schema)
  .wire("<-recover.", core.passthrough({ recover: true }))
  .wire("completion->", toolRouter)
  .wire("completion->Agent", agentMemory)
  .wire("$error->", board.output({ $id: "error" }));

export const orderAgent = board;
