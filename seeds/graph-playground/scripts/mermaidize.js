/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";

const TEMPLATE = `# {{title}}
---

\`\`\`mermaid
%%{init: 'themeVariables': { 'fontFamily': 'Fira Code, monospace' }}%%
graph TD;
{{mermaid}}
classDef default stroke:#ffab40,fill:#fff2ccff,color:#000
classDef input stroke:#3c78d8,fill:#c9daf8ff,color:#000
classDef output stroke:#38761d,fill:#b6d7a8ff,color:#000
classDef passthrough stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slot stroke:#a64d79,fill:#ead1dcff,color:#000
classDef slotted stroke:#a64d79
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

const shape = (descriptor) => {
  const node = descriptor.id;
  // Mermaid gets confused by hyphens in node ids
  // For example `get-graph` id will throw a syntax error, because it thinks
  // that it sees the `graph` token.
  const nodeId = node && node.replace(/-/g, "");
  const nodeType = descriptor.type;
  const text = `"${nodeType}\nid='${node}'"`;
  switch (nodeType) {
    case "include":
      return `${nodeId}[[${text}]]:::include`;
    case "slot":
      return `${nodeId}((${text})):::slot`;
    case "passthrough":
      return `${nodeId}((${text})):::passthrough`;
    case "input":
      return `${nodeId}[/${text}/]:::input`;
    case "output":
      return `${nodeId}{{${text}}}:::output`;
    default:
      return `${nodeId}[${text}]`;
  }
};

const describeEdge = (edge, nodeMap) => {
  const from = edge.from;
  const fromNode = shape(nodeMap.get(from) || "");
  const to = edge.to;
  const toNode = shape(nodeMap.get(to) || "");
  const input = edge.in;
  const output = edge.out;
  const optional = edge.optional;
  const constant = edge.constant;
  if (output === "*") {
    return `${fromNode} -- all --> ${toNode}`;
  }
  if (output && input) {
    if (optional) return `${fromNode} -. ${output}:${input} .-> ${toNode}`;
    if (constant) return `${fromNode} -- ${output}:${input} --o ${toNode}`;
    return `${fromNode} -- ${output}:${input} --> ${toNode}`;
  }
  return `${fromNode} --> ${toNode}`;
};

const describeSubgraphs = (edge, nodeMap) => {
  const fromNode = nodeMap.get(edge.from);
  const type = fromNode.type;
  if (type !== "include") return "";

  const slotted = fromNode.configuration.slotted;
  if (!slotted) return "";
  const subgraphs = Object.entries(slotted).map(([name, subgraph]) => {
    const subgraphNodeMap = new Map(
      subgraph.nodes.map((node) => [node.id, node])
    );
    const subgraphEdges = subgraph.edges.map((edge) =>
      describeEdge(edge, subgraphNodeMap)
    );
    return `\nsubgraph ${name}\n${subgraphEdges.join(
      "\n"
    )}\nend\n${name}:::slotted --> ${fromNode.id}\n`;
  });
  return subgraphs.join("\n");
};

const mermaidize = (file) => {
  const { edges, nodes } = JSON.parse(file);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const result = edges.map((edge) => {
    const mermEdge = describeEdge(edge, nodeMap);
    const mermSubgraphs = describeSubgraphs(edge, nodeMap);
    return `${mermEdge}${mermSubgraphs}`;
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
