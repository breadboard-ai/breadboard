/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";

const TEMPLATE = `# {{title}}
---

\`\`\`mermaid
graph TD;
{{mermaid}}
\`\`\``;

const IN_DIR = "./graphs";
const OUT_DIR = "./docs/graphs";

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

const ensureDir = async () => {
  await mkdir(OUT_DIR, { recursive: true });
};

const substitute = (template, values) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, value),
    template
  );
};

const mermaidize = (file) => {
  const { nodes, edges } = JSON.parse(file);
  const result = edges.map(({ entry, from, to }) => {
    const fromNode = entry ? `${from.node}>${from.node}]` : from.node;
    if (from.output && to.input)
      return `${fromNode} -- ${from.output}:${to.input} --> ${to.node}`;
    return `${from.node} --> ${to.node}`;
  });
  return result.join("\n");
};

await ensureDir();
await Promise.all(
  graphs.map(async (graph) => {
    const file = await readFile(`${IN_DIR}/${graph}`, "utf-8");
    const mermaid = mermaidize(file);
    const output = substitute(TEMPLATE, {
      title: graph.replace(".json", ""),
      mermaid,
    });
    await writeFile(`${OUT_DIR}/${graph.replace(".json", ".md")}`, output);
    return "";
  })
);
