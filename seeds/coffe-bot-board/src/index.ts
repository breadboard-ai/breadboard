/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

import { config } from "dotenv";
import { Template } from "./template.js";

config();

const board = new Board();
const kit = board.addKit(Starter);

const template = await new Template("v1-multi-move", board, kit).make();
board.input().wire(
  "user->",
  template.wire(
    "prompt->text",
    kit
      .generateText({
        safetySettings: [
          {
            category: "HARM_CATEGORY_DEROGATORY",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      })
      .wire("completion->", board.output({ $id: "completion" }))
      .wire("filters->", board.output({ $id: "blocked" }))
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
  )
);

await writeFile("./graphs/coffee-bot.json", JSON.stringify(board, null, 2));

await writeFile(
  "./docs/coffee-bot.md",
  `# Coffee Bot\n\n\`\`\`mermaid\n${board.mermaid()}\n\`\`\``
);

const result = await board.runOnce({
  user: "I'd like a latte",
});

console.log(result);
