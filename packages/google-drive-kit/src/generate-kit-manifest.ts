/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { fileURLToPath } from "url";

import { asRuntimeKit, type KitManifest } from "@google-labs/breadboard";

import { serialize } from "@breadboard-ai/build";
import { writeFile } from "fs/promises";

import { default as kitConstructor, components } from "./index.js";

const MANIFEST_NAME = "google-drive.kit.json";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(MODULE_DIR, "..");
const BOARDS_DIR = path.join(ROOT_DIR, "boards");
const MANIFEST_PATH = path.join(ROOT_DIR, MANIFEST_NAME);

const kit = asRuntimeKit(kitConstructor);

const manifest: KitManifest = {
  title: kit.title,
  description: kit.description,
  version: kit.version,
  url: `https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/google-drive-kit/${MANIFEST_NAME}`,
  nodes: Object.fromEntries(
    Object.entries(components).map(([name, definition]) => [
      name,
      serialize(definition),
    ])
  ),
};

const generate = async () => {
  // Write individual nodes to the file system
  const nodes = Object.entries(manifest.nodes);
  await Promise.all(
    nodes.map(async ([name, node]) => {
      if (node.metadata?.deprecated) return;
      const nodePath = path.join(BOARDS_DIR, `${name}.bgl.json`);
      const json = JSON.stringify(node, null, 2);
      return writeFile(nodePath, json);
    })
  );

  // Write the manifest to the file system
  const json = JSON.stringify(manifest, null, 2);
  return writeFile(MANIFEST_PATH, json);
};

await generate();
