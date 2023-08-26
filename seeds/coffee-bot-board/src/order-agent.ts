/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { PromptMaker } from "./template.js";

import { schemishGenerator } from "./schemish-generator.js";
import { NodeValue } from "@google-labs/graph-runner";

const BASE = "v2-multi-agent";

const maker = new PromptMaker(BASE);
const board = new Board();
const kit = board.addKit(Starter);

const prologuePrompt = kit
  .promptTemplate(
    ...(await maker.prompt("order-agent-prologue", "orderAgentPrologue"))
  )
  .wire("<-tools.", board.passthrough(await maker.part("tools", "json")));

const schema = board.passthrough(await maker.jsonPart("order-schema"));

const epiloguePrompt = kit.promptTemplate(
  ...(await maker.prompt("order-agent-epilogue", "orderAgentEpilogue"))
);

const customerMemory = kit.append({ $id: "customerMemory" });
const agentMemory = kit.append({ $id: "agentMemory" });
const toolMemory = kit.append({ $id: "toolMemory" });

board.passthrough({ accumulator: "\n" }).wire("accumulator->", customerMemory);
customerMemory.wire("accumulator->", agentMemory);
agentMemory
  .wire("accumulator->", toolMemory)
  .wire("accumulator->", customerMemory);
toolMemory.wire("accumulator->", agentMemory);

epiloguePrompt
  .wire("memory<-accumulator", customerMemory)
  .wire("memory<-accumulator", toolMemory);

const checkMenuTool = board.passthrough().wire(
  "checkMenu->json",
  kit.jsonata("actionInput").wire(
    "result->customer",
    board
      .slot("checkMenu")
      .wire("bot->Tool", toolMemory)
      .wire("bot->", board.output({ $id: "checkMenu-tool-output" }))
      .wire("error->", board.output({ $id: "error" }))
  )
);

const summarizeMenuTool = board.passthrough().wire(
  "summarizeMenu->json",
  kit.jsonata("actionInput").wire(
    "result->customer",
    board
      .slot("summarizeMenu")
      .wire("bot->Tool", toolMemory)
      .wire("bot->", board.output({ $id: "summarizeMenu-tool-output" }))
      .wire("error->", board.output({ $id: "error" }))
  )
);

const customerTool = board
  .passthrough()
  .wire(
    "customer->json",
    kit
      .jsonata("actionInput")
      .wire(
        "result->message",
        board
          .input("", { $id: "ask-customer-tool" })
          .wire("customer->Customer", customerMemory)
      )
  );

const finalizeOrderTool = board
  .passthrough()
  .wire("finalizeOrder->bot", board.output({ $id: "finalizeOrder" }));

function route({ completion }: { completion: NodeValue }) {
  const data = completion as NodeValue & { action: string };
  return { [data.action]: data, tool: data.action };
}

const toolRouter = kit
  .runJavascript("route", {
    $id: "toolRouter",
    code: route.toString(),
    raw: true,
  })
  .wire("tool->bot", board.output({ $id: "selected-tool" }))
  .wire("customer->", customerTool)
  .wire("checkMenu->", checkMenuTool)
  .wire("summarizeMenu->", summarizeMenuTool)
  .wire("finalizeOrder->", finalizeOrderTool);

board
  .input("", { $id: "first-ask-customer" })
  .wire("customer->Customer", customerMemory);

board
  .include(schemishGenerator, { $id: "generator" })
  .wire("prologue<-prompt.", prologuePrompt)
  .wire("epilogue<-prompt.", epiloguePrompt)
  .wire("schema<-order-schema.", schema)
  .wire("<-recover.", board.passthrough({ recover: true }))
  .wire("completion->", toolRouter)
  .wire("completion->Agent", agentMemory)
  .wire("error->", board.output({ $id: "error" }));

export const orderAgent = board;
