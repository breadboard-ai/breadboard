/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";

import { toMermaid } from "@google-labs/graph-runner";

const IN_DIR = "./graphs";
const OUT_DIR = "./docs/graphs";

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

const ensureDir = async () => {
  await mkdir(OUT_DIR, { recursive: true });
};

await ensureDir();
await Promise.all(
  graphs.map(async (graph) => {
    const file = await readFile(`${IN_DIR}/${graph}`, "utf-8");
    const mermaid = toMermaid(JSON.parse(file));
    const output = `# ${graph.replace(".json", "")}
---

\`\`\`mermaid
${mermaid}
\`\`\``;
    await writeFile(`${OUT_DIR}/${graph.replace(".json", ".md")}`, output);
  })
);
