/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile, readdir } from "fs/promises";

const BOARD_DIR = "./dist/src/boards";
const SOURCE_DIR = "./src/boards";
const DOC_DIR = "./docs/graphs";
const GRAPH_DIR = "./graphs";

const boardFiles = (await readdir(BOARD_DIR)).filter((file) =>
  file.endsWith(".js")
);

const writeMermaid = async (file, mermaid) => {
  const title = file.replace(".js", "");
  const boardName = file.replace(".js", ".ts");
  const boardURL = `../.${SOURCE_DIR}/${boardName}`;
  const graphName = file.replace(".js", ".json");
  const graphURL = `../.${GRAPH_DIR}/${graphName}`;
  const output = `# ${title}
  - Original: [\`${boardName}\`](${boardURL})
  - Graph: [\`${graphName}\`](${graphURL})
  
  \`\`\`mermaid
  ${mermaid}
  \`\`\``;
  await writeFile(`${DOC_DIR}/${file.replace(".js", ".md")}`, output);
};

const writeJSON = async (file, graph) => {
  await writeFile(
    `${GRAPH_DIR}/${file.replace(".js", ".json")}`,
    JSON.stringify(graph, null, 2)
  );
};

await Promise.all(
  boardFiles.map(async (file) => {
    const boardImport = await import(`.${BOARD_DIR}/${file}`);
    const board = boardImport.default;
    await writeMermaid(file, board.mermaid());
    await writeJSON(file, board);
  })
);
