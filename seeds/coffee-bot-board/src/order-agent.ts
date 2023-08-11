/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { Template } from "./template.js";

const board = new Board();
const kit = board.addKit(Starter);

const orderAgentTemplate = new Template("v2-multi-agent", board, kit);
const prompt = await orderAgentTemplate.loadTemplate("order-agent.txt");
await orderAgentTemplate.wirePart("tools", "json");
await orderAgentTemplate.wirePart("order-format", "json");

const customerMemory = kit.append({ $id: "customerMemory" });
const agentMemory = kit.append({ $id: "agentMemory" });
const toolMemory = kit.append({ $id: "toolMemory" });

board.passthrough({ accumulator: "\n" }).wire("accumulator->", customerMemory);
customerMemory.wire("accumulator->", agentMemory);
agentMemory
  .wire("accumulator->", toolMemory)
  .wire("accumulator->", customerMemory);
toolMemory.wire("accumulator->", agentMemory);

prompt
  .wire("memory<-accumulator", customerMemory)
  .wire("memory<-accumulator", toolMemory);

function checkMenu({ actionInput }: { actionInput: string }) {
  // Hard-code the output for now.
  return {
    name: "checkMenu",
    result: {
      item: "Chai Latte",
      extras: [],
      availableExtras: ["Soy Milk", "Almond Milk", "Oat Milk", "Honey"],
    },
  };
}

const checkMenuTool = kit
  .runJavascript("checkMenu", {
    $id: "checkMenu",
    code: checkMenu.toString(),
  })
  .wire("result->Tool", toolMemory);

function route({ completion }: { completion: string }) {
  const data = JSON.parse(completion);
  return { [data.action]: data };
}

const toolRouter = kit
  .runJavascript("route", {
    $id: "toolRouter",
    code: route.toString(),
    raw: true,
  })
  .wire("customer->bot", board.output())
  .wire(
    "customer->json",
    kit
      .jsonata("actionInput")
      .wire(
        "result->message",
        board.input().wire("customer->Customer", customerMemory)
      )
  )
  .wire("checkMenu->", checkMenuTool);

board.input().wire("customer->Customer", customerMemory);

prompt.wire(
  "prompt->text",
  kit
    .generateText({
      stopSequences: ["Tool:", "Customer:", "\n\n"],
      safetySettings: [
        {
          category: "HARM_CATEGORY_DEROGATORY",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    })
    .wire("completion->", toolRouter)
    .wire("completion->Agent", agentMemory)
    .wire("filters->", board.output({ $id: "blocked" }))
    .wire("<-PALM_KEY.", kit.secrets(["PALM_KEY"]))
);

export const orderAgent = board;
