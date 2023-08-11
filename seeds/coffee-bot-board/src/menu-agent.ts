/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { Template } from "./template.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

const menuAgentTemplate = new Template("v2-multi-agent", board, kit);
const menu = await menuAgentTemplate.loadTemplate("menu-agent.txt");
await menuAgentTemplate.wirePart("menu", "txt");
await menuAgentTemplate.wirePart("menu-format", "json");
await menuAgentTemplate.wirePart("menu-not-found", "json");

function parseResponse({ completion }: { completion: string }) {
  return { bot: JSON.parse(completion) };
}

board.input().wire(
  "customer->",
  menu.wire(
    "prompt->text",
    kit
      .generateText({
        stopSequences: ["Customer:"],
      })
      .wire("filters->error", board.output({ $id: "error" }))
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
      .wire(
        "completion->",
        kit
          .runJavascript("parseResponse", {
            $id: "parseResponse",
            code: parseResponse.toString(),
            raw: true,
          })
          .wire("bot->", board.output({ $id: "bot" }))
      )
  )
);

export const menuAgent = board;
