/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// import { GraphDescriptor } from "@google-labs/breadboard";
import { Dirent } from "fs";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
// import { execSync } from "child_process";

const MODULE_DIR: string = path.dirname(fileURLToPath(import.meta.url));
const PATH: string = path.join(MODULE_DIR, "boards");
const MANIFEST_PATH: string = path.join(MODULE_DIR, "../public");
const GRAPH_PATH: string = path.join(MODULE_DIR, "../public/graphs");

await mkdir(GRAPH_PATH, { recursive: true });

type ManifestItem = {
  title: string;
  url: string;
  version: string;
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

// async function findPyFiles(dir: string): Promise<string[]> {
//   const files: Dirent[] = await readdir(dir, { withFileTypes: true });
//   let pyFiles: string[] = [];
//   for (const file of files) {
//     const res: string = path.resolve(dir, file.name);
//     if (file.isDirectory()) {
//       pyFiles = pyFiles.concat(await findPyFiles(res));
//     } else if (file.isFile() && file.name.endsWith(".py")) {
//       pyFiles.push(res);
//     }
//   }
//   return pyFiles;
// }

async function saveBoard(filePath: string): Promise<ManifestItem | undefined> {
  try {
    const board = await import(filePath);

    if (!board.default) {
      // This is probably not a board or a board that doesn't want to be in the
      // manifest.
      return;
    }
    const relativePath: string = path.relative(PATH, filePath);
    const baseName: string = path.basename(filePath);
    const jsonFile: string = baseName.replace(".ts", ".json");

    // Create corresponding directories based on the relative path
    const graphDir: string = path.dirname(path.join(GRAPH_PATH, relativePath));

    // Make sure the directories exist
    await mkdir(graphDir, { recursive: true });

    const manifestEntry: ManifestItem = {
      title: board.default.title ?? "Untitled",
      url: `/graphs/${relativePath.replace(".ts", ".json")}`,
      version: board.default.version ?? undefined,
    };

    await writeFile(
      path.join(graphDir, jsonFile),
      JSON.stringify(board.default, null, 2)
    );
    return manifestEntry;
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.stack);
    }
    throw new Error(`Error loading ${filePath}: ${e}`);
  }
}

// async function savePythonBoard(
//   filePath: string
// ): Promise<ManifestItem | undefined> {
//   try {
//     const relativePath: string = path.relative(PATH, filePath);
//     const baseName: string = path.basename(filePath);
//     const jsonFile: string = baseName.replace(".py", ".json");

//     // Create corresponding directories based on the relative path
//     const graphDir: string = path.dirname(path.join(GRAPH_PATH, relativePath));

//     // Make sure the directories exist
//     await mkdir(graphDir, { recursive: true });

//     const jsonPath = path.join(graphDir, jsonFile);
//     execSync(`python3 ${filePath} ` + jsonPath);
//     const boardOutput = await readFile(jsonPath);
//     const graph_descriptor = JSON.parse(
//       boardOutput.toString()
//     ) as GraphDescriptor;

//     const manifestEntry: ManifestItem = {
//       title: graph_descriptor.title ?? "Untitled",
//       url: `/graphs/${relativePath.replace(".py", ".json")}`,
//       version: graph_descriptor.version ?? "undefined",
//     };

//     return manifestEntry;
//   } catch (e) {
//     console.error(`Error loading ${filePath}: ${e}`);
//   }
// }

async function saveAllBoards(): Promise<void> {
  const tsFiles = await findTsFiles(PATH);
  const manifest = [];
  for (const file of tsFiles) {
    const manifestEntry = await saveBoard(file);
    if (!manifestEntry) continue;
    // Avoid adding .local.json files to the manifest
    if (!file.endsWith(".local.ts")) {
      manifest.push(manifestEntry);
    }
  }
  // TODO: Reenable.
  // const pyFiles = await findPyFiles(PATH);
  // for (const file of pyFiles) {
  //   const manifestEntry = await savePythonBoard(file);
  //   if (!manifestEntry) {
  //     throw new RangeError();
  //     continue;
  //   }
  //   manifest.push(manifestEntry);
  // }
  await writeFile(
    path.join(MANIFEST_PATH, "local-boards.json"),
    JSON.stringify(manifest, null, 2)
  );
}

await saveAllBoards();
