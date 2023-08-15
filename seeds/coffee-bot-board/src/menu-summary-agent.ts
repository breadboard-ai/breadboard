/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { PromptMaker } from "./template.js";

config();

const maker = new PromptMaker("v2-multi-agent");
export const menuSummaryAgent = new Board();
const kit = menuSummaryAgent.addKit(Starter);

const menu = kit.promptTemplate(
  ...(await maker.prompt("menu-summary-agent", "menuSummaryAgent"))
);
menu.wire(
  "<-menu.",
  menuSummaryAgent.passthrough(await maker.part("menu", "txt"))
);

function formatOutput({ completion }: { completion: string }) {
  const output = {
    name: "summarizeOrder",
    result: completion,
  };
  return { bot: output };
}

menuSummaryAgent.input().wire(
  "customer->",
  menu.wire(
    "prompt->text",
    kit
      .generateText({
        stopSequences: ["Customer:"],
      })
      .wire("filters->error", menuSummaryAgent.output({ $id: "error" }))
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
      .wire(
        "completion->",
        kit
          .runJavascript("formatOutput", {
            $id: "formatOutput",
            code: formatOutput.toString(),
            raw: true,
          })
          .wire("bot->", menuSummaryAgent.output({ $id: "bot" }))
      )
  )
);
