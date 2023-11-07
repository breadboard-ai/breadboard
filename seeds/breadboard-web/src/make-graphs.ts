/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { toMermaid } from "@google-labs/breadboard";
import { Dirent } from "fs";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR: string = path.dirname(fileURLToPath(import.meta.url));
const PATH: string = path.join(MODULE_DIR, "boards");
const MANIFEST_PATH: string = path.join(MODULE_DIR, "../public");
const GRAPH_PATH: string = path.join(MODULE_DIR, "../public/graphs");
const DIAGRAM_PATH: string = path.join(MODULE_DIR, "../docs/graphs");

await mkdir(GRAPH_PATH, { recursive: true });
await mkdir(DIAGRAM_PATH, { recursive: true });

type ManifestItem = {
  title: string;
  url: string;
};

async function findTsFiles(dir: string): Promise<string[]> {
  const files: Dirent[] = await readdir(dir, { withFileTypes: true });
  let tsFiles: string[] = [];
  for (const file of files) {
    const res: string = path.resolve(dir, file.name);
    if (file.isDirectory()) {
      tsFiles = tsFiles.concat(await findTsFiles(res));
    } else if (file.isFile() && file.name.endsWith(".ts")) {
      tsFiles.push(res);
    }
  }
  return tsFiles;
}

async function saveBoard(filePath: string): Promise<ManifestItem> {
  const board = await import(filePath);
  const relativePath: string = path.relative(PATH, filePath);
  const baseName: string = path.basename(filePath);
  const jsonFile: string = baseName.replace(".ts", ".json");
  const diagramFile: string = baseName.replace(".ts", ".md");

  // Create corresponding directories based on the relative path
  const graphDir: string = path.dirname(path.join(GRAPH_PATH, relativePath));
  const diagramDir: string = path.dirname(path.join(DIAGRAM_PATH, relativePath));

  // Make sure the directories exist
  await mkdir(graphDir, { recursive: true });
  await mkdir(diagramDir, { recursive: true });

  const manifestEntry: { title: string; url: string } = {
    title: board.default.title,
    url: `/graphs/${relativePath.replace(".ts", ".json")}`,
  };

  await writeFile(
    path.join(graphDir, jsonFile),
    JSON.stringify(board.default, null, 2),
  );
  await writeFile(
    path.join(diagramDir, diagramFile),
    `## ${baseName}\n\n\`\`\`mermaid\n${toMermaid(board.default)}\n\`\`\``,
  );
  return manifestEntry;
}

async function saveAllBoards(): Promise<void> {
  const tsFiles = await findTsFiles(PATH);
  const manifest = [];
  for (const file of tsFiles) {
    // Avoid adding .local.json files to the manifest
    if (!file.endsWith(".local.ts")) {
      const manifestEntry = await saveBoard(file);
      manifest.push(manifestEntry);
    }
  }
  await writeFile(
    path.join(MANIFEST_PATH, "local-boards.json"),
    JSON.stringify(manifest, null, 2),
  );
}

await saveAllBoards();
