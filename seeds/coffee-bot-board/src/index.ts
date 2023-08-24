/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { config } from "dotenv";

import { Board, LogProbe } from "@google-labs/breadboard";

import { run } from "./cli.js";
import { orderAgent } from "./order-agent.js";
import { menuAgent } from "./menu-agent.js";
import { menuSummaryAgent } from "./menu-summary-agent.js";
import { schemishGenerator } from "./schemish-generator.js";

config();

const experiment = process.argv.includes("-x");

const writeGraphs = async (board: Board, filename: string) => {
  await writeFile(`./graphs/${filename}.json`, JSON.stringify(board, null, 2));

  await writeFile(
    `./docs/${filename}.md`,
    `# Coffee Bot graph for ${filename}.json\n\n\`\`\`mermaid\n${board.mermaid()}\n\`\`\``
  );
};

await writeGraphs(orderAgent, "order-agent");
await writeGraphs(menuAgent, "menu-agent");
await writeGraphs(menuSummaryAgent, "menu-summary-agent");
await writeGraphs(schemishGenerator, "schemish-generator");

if (experiment) {
  const outputs = await schemishGenerator.runOnce(
    {
      prologue:
        "You are the ordering agent and your job is to listen to the customer and record their order in a specified format.",
      epilogue: "Begin!\nCustomer: I'd like to order a chai latte",
      schema: {
        type: "object",
        properties: {
          order: {
            type: "string",
            description: "The current order of a customer.",
          },
        },
        required: ["order"],
      },
    },
    new LogProbe()
  );
  console.log(outputs);
} else {
  await run(orderAgent, {
    checkMenu: menuAgent,
    summarizeMenu: menuSummaryAgent,
  });
}
