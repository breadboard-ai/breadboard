/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { toMermaid } from "@google-labs/breadboard";
import { mkdir, readdir, writeFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATH = path.join(MODULE_DIR, "boards");
const MANIFEST_PATH = path.join(MODULE_DIR, "../public");
const GRAPH_PATH = path.join(MODULE_DIR, "../public/graphs");
const DIAGRAM_PATH = path.join(MODULE_DIR, "../docs/graphs");

await mkdir(GRAPH_PATH, { recursive: true });
await mkdir(DIAGRAM_PATH, { recursive: true });

const findTsFiles = async (dir: string | Buffer | URL): Promise<string[]> => {
  let files = await readdir(dir, { withFileTypes: true });
  let tsFiles: string[] = [];
  for (let file of files) {
    const res = path.resolve(<string>dir, file.name);
    if (file.isDirectory()) {
      tsFiles = tsFiles.concat(await findTsFiles(res));
    } else if (file.isFile() && file.name.endsWith('.ts')) {
      tsFiles.push(res);
    }
  }
  return tsFiles;
};

const saveBoard = async (filePath: string) => {
  const board = await import(filePath);
  const relativePath = path.relative(PATH, filePath);
  const baseName = path.basename(filePath);
  const jsonFile = baseName.replace(".ts", ".json");
  const diagramFile = baseName.replace(".ts", ".md");

  // Create corresponding directories based on the relative path
  const graphDir = path.dirname(path.join(GRAPH_PATH, relativePath));
  const diagramDir = path.dirname(path.join(DIAGRAM_PATH, relativePath));

  // Make sure the directories exist
  await mkdir(graphDir, { recursive: true });
  await mkdir(diagramDir, { recursive: true });

  const manifestEntry = {
    title: board.default.title,
    url: `/graphs/${relativePath.replace('.ts', '.json')}`,
  };

  await writeFile(
    path.join(graphDir, jsonFile),
    JSON.stringify(board.default, null, 2)
  );
  await writeFile(
    path.join(diagramDir, diagramFile),
    `## ${baseName}\n\n\`\`\`mermaid\n${toMermaid(board.default)}\n\`\`\``
  );
  return manifestEntry;
};

const saveAllBoards = async () => {
  const tsFiles = await findTsFiles(PATH);
  const manifest = [];
  for (const file of tsFiles) {
    const manifestEntry = await saveBoard(file);
    manifest.push(manifestEntry);
  }
  await writeFile(
    path.join(MANIFEST_PATH, "local-boards.json"),
    JSON.stringify(manifest, null, 2)
  );
};

await saveAllBoards();
