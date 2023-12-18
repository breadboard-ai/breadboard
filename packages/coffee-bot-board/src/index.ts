/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";

import { config } from "dotenv";

import { Board } from "@google-labs/breadboard";

import { run } from "./cli.js";
import { orderAgent } from "./order-agent.js";
import { menuAgent } from "./menu-agent.js";
import { menuSummaryAgent } from "./menu-summary-agent.js";
import { schemishGenerator } from "./schemish-generator.js";

config();

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

await run(orderAgent, {
  checkMenu: menuAgent,
  summarizeMenu: menuSummaryAgent,
});
