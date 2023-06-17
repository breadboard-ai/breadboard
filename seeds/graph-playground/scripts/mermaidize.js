import { readFile, writeFile, readdir } from "fs/promises";

const graphs = (await readdir("./graphs/")).filter((file) =>
  file.endsWith(".json")
);

const substitute = (template, values) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, value),
    template
  );
};

const TEMPLATE = `# {{title}}
---

\`\`\`mermaid
graph LR;
{{mermaid}}
\`\`\``;

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

await Promise.all(
  graphs.map(async (graph) => {
    const file = await readFile(`./graphs/${graph}`, "utf-8");
    const mermaid = mermaidize(file);
    const output = substitute(TEMPLATE, {
      title: graph.replace(".json", ""),
      mermaid,
    });
    await writeFile(`./docs/${graph.replace(".json", ".md")}`, output);
    return "";
  })
);
