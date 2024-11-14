/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { fileURLToPath } from "url";

import { asRuntimeKit, type GraphDescriptor } from "@google-labs/breadboard";

import { serialize } from "@breadboard-ai/build";
import { writeFile } from "fs/promises";

import { default as kitConstructor, components } from "./index.js";

import appendToDoc from "./bgl/append-to-doc.bgl.json";
import readFromDoc from "./bgl/read-from-doc.bgl.json";
import contextToSlides from "./bgl/context-to-slides.bgl.json";

const MANIFEST_NAME = "google-drive.kit.json";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(MODULE_DIR, "..");
const BOARDS_DIR = path.join(ROOT_DIR, "boards");
const MANIFEST_PATH = path.join(ROOT_DIR, MANIFEST_NAME);

const kit = asRuntimeKit(kitConstructor);

const graphs: Record<string, GraphDescriptor> = {
  ...Object.fromEntries(
    Object.entries(components).map(([name, definition]) => [
      name,
      serialize(definition),
    ])
  ),
  appendToDoc: addIcon(appendToDoc),
  readFromDoc: addIcon(readFromDoc),
  contextToSlides: addIcon(contextToSlides),
};

const manifest: GraphDescriptor = {
  title: kit.title,
  description: kit.description,
  version: kit.version,
  url: "npm:@breadboard-ai/google-drive-kit",
  exports: Object.keys(graphs).map((id) => `#${id}`),
  graphs,
  nodes: [],
  edges: [],
};

const generate = async () => {
  // Write individual nodes to the file system
  const nodes = Object.entries(manifest.graphs!);
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

function addIcon(o: unknown) {
  const board = o as GraphDescriptor;
  board.metadata ??= {};
  board.metadata.icon = "google-drive";
  return board;
}

await generate();
