/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// import { GraphDescriptor } from "@google-labs/breadboard";
import { SerializableBoard, serialize } from "@breadboard-ai/build";
import {
  BoardReference,
  BreadboardManifestBuilder,
} from "@breadboard-ai/manifest";
import {
  formatGraphDescriptor,
  GraphDescriptor,
} from "@google-labs/breadboard";
import { Dirent } from "fs";
import { mkdir, readdir, writeFile, readFile, cp } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const MODULE_DIR: string = path.dirname(fileURLToPath(import.meta.url));
const PATH: string = path.join(MODULE_DIR, "boards");
const MANIFEST_PATH: string = path.join(MODULE_DIR, "..");
const GRAPH_PATH: string = path.join(MODULE_DIR, "..", "example-boards");

await mkdir(GRAPH_PATH, { recursive: true });

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

async function findJsonFiles(dir: string): Promise<string[]> {
  const files: Dirent[] = await readdir(dir, { withFileTypes: true });
  let tsFiles: string[] = [];
  for (const file of files) {
    const res: string = path.resolve(dir, file.name);
    if (file.isDirectory()) {
      tsFiles = tsFiles.concat(await findJsonFiles(res));
    } else if (file.isFile() && file.name.endsWith(".json")) {
      tsFiles.push(res);
    }
  }
  return tsFiles;
}

async function saveTypeScriptBoard(
  filePath: string
): Promise<BoardReference | undefined> {
  try {
    const module = await import(filePath);

    if (!module.default) {
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

    const url = `/example-boards/${relativePath.replace(".ts", ".json")}`;
    if ("inputs" in module.default && "outputs" in module.default) {
      // TODO(aomarks) Not a great way to detect build boards.
      const board = module.default as SerializableBoard;
      const manifest: BoardReference = {
        title: module.default.title ?? "Untitled (build API)",
        reference: url,
        version: module.default.version ?? "",
      };
      await writeFile(
        path.join(graphDir, jsonFile),
        JSON.stringify(serialize(board), null, 2)
      );
      return manifest;
    } else {
      const board = module.default as SerializableBoard;
      const manifest: BoardReference = {
        title: module.default.title ?? "Untitled",
        reference: url,
        version: module.default.version ?? undefined,
      };
      await writeFile(
        path.join(graphDir, jsonFile),
        JSON.stringify(
          formatGraphDescriptor(JSON.parse(JSON.stringify(board))),
          null,
          2
        )
      );
      return manifest;
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.stack);
    }
    throw new Error(`Error loading ${filePath}: ${e}`);
  }
}

async function saveJsonBoard(
  filePath: string
): Promise<BoardReference | undefined> {
  const relativePath: string = path.relative(PATH, filePath);
  const url = `/example-boards/${relativePath}`;
  try {
    // Create corresponding directories based on the relative path
    const graphDir: string = path.dirname(path.join(GRAPH_PATH, relativePath));

    // Make sure the directories exist
    await mkdir(graphDir, { recursive: true });
    const destBoardPath = path.join(graphDir, path.basename(filePath));

    const boardData = await readFile(filePath, { encoding: "utf-8" });
    const file = JSON.parse(boardData) as GraphDescriptor;
    const manifest: BoardReference = {
      title: file.title ?? "Untitled (Raw BGL File)",
      reference: url,
      version: file.version ?? "0.0.1",
      tags: file.metadata?.tags ?? undefined,
    };

    await cp(filePath, destBoardPath);

    return manifest;
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.stack);
    }
    throw new Error(`Error loading ${filePath}: ${e}`);
  }
}

async function saveAllBoards(prefix: string): Promise<void> {
  const tsFiles = await findTsFiles(path.join(PATH, prefix));
  const jsonFiles = await findJsonFiles(path.join(PATH, prefix));
  const manifest: BreadboardManifestBuilder = new BreadboardManifestBuilder();

  for (const file of tsFiles) {
    const manifestEntry = await saveTypeScriptBoard(file);
    if (!manifestEntry) continue;
    // Avoid adding .local.json files to the manifest
    if (!file.endsWith(".local.ts")) {
      manifest.addBoard(manifestEntry);
    }
  }

  for (const file of jsonFiles) {
    const manifestEntry = await saveJsonBoard(file);
    if (!manifestEntry) continue;
    // Avoid adding .local.json files to the manifest
    if (!file.endsWith(".local.json")) {
      manifest.addBoard(manifestEntry);
    }
  }

  await writeFile(
    path.join(MANIFEST_PATH, `${prefix}-boards.json`),
    JSON.stringify(manifest, null, 2)
  );
}

await Promise.all([saveAllBoards("playground"), saveAllBoards("examples")]);
