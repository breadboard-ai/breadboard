/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A script to generate graphs from various JSON files laying around this
 * package.
 *
 * Generates one markdown file per directory.
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";

import { toMermaid } from "@google-labs/graph-runner";

const IN_DIRS = ["tests/data"];
const OUT_DIR = "./docs/graphs";

const ensureDir = async (dir) => {
  await mkdir(dir, { recursive: true });
};

const readGraphs = async (dir) => {
  const files = (await readdir(`${dir}/`)).filter((file) =>
    file.endsWith(".json")
  );
  const graphs = await Promise.all(
    files.map(async (file) => {
      const graph = await readFile(`${dir}/${file}`, "utf-8");
      return {
        file,
        graph: JSON.parse(graph),
      };
    })
  );
  return graphs;
};

await ensureDir(OUT_DIR);
await Promise.all(
  IN_DIRS.map(async (dir) => {
    const graphs = await readGraphs(dir);
    const mermaid = graphs
      .map(({ file, graph }) => {
        const mermaid = toMermaid(graph, "LR");
        return `## ${file}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\``;
      })
      .join("\n\n");
    const markdown = `# ${dir}\n${mermaid}`;
    await writeFile(`${OUT_DIR}/${dir.replace("/", "-")}.md`, markdown);
  })
);
