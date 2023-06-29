/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";

const TEMPLATE = `# {{title}}
---

\`\`\`mermaid
%%{init: {'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}}%%
graph TD;
{{mermaid}}
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
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

const shape = (node, nodeType) => {
  const text = `"${nodeType}\nid='${node}'"`;
  switch (nodeType) {
    case "include":
      return `${node}[[${text}]]:::include`;
    case "slot":
      return `${node}(((${text}))):::slot`;
    case "passthrough":
      return `${node}((${text})):::passthrough`;
    case "input":
      return `${node}[/${text}/]:::input`;
    case "output":
      return `${node}{{${text}}}:::output`;
    default:
      return `${node}[${text}]`;
  }
};

const mermaidize = (file) => {
  const { edges, nodes } = JSON.parse(file);
  const nodeTypes = new Map(nodes.map((node) => [node.id, node.type]));
  const result = edges.map((edge) => {
    const from = edge.from;
    const fromNode = shape(from, nodeTypes.get(from) || "");
    const to = edge.to;
    const toNode = shape(to, nodeTypes.get(to) || "");
    const input = edge.in;
    const output = edge.out;
    const optional = edge.optional;
    if (output && input) {
      if (optional) return `${fromNode} -. ${output}:${input} .-> ${toNode}`;
      return `${fromNode} -- ${output}:${input} --> ${toNode}`;
    }
    return `${fromNode} --> ${toNode}`;
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
