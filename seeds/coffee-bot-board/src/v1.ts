/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";
import { Core } from "@google-labs/core-kit";

import { config } from "dotenv";
import { Template } from "./template.js";

config();

const board = new Board();
const kit = board.addKit(Starter);
const core = board.addKit(Core);
const palm = board.addKit(PaLMKit);

const template = await new Template("v1-multi-move", board, kit, core).make();
board.input().wire(
  "user->",
  template.wire(
    "prompt->text",
    palm
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
      .wire("<-PALM_KEY", kit.secrets({ keys: ["PALM_KEY"] }))
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
