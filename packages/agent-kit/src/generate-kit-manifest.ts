/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { serialize } from "@breadboard-ai/build";
import type { GraphDescriptor } from "@breadboard-ai/types";

import content from "./boards/content.js";
import human from "./boards/human.js";
import joiner from "./boards/joiner.js";
import looper from "./boards/looper.js";
import repeater from "./boards/repeater.js";
import specialist from "./boards/specialist.js";
import structuredWorker from "./boards/structured-worker.js";
import worker from "./boards/worker.js";

const MANIFEST_NAME = "agent.kit.json";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(MODULE_DIR, "..");
const BOARDS_DIR = path.join(ROOT_DIR, "boards");
const MANIFEST_PATH = path.join(ROOT_DIR, MANIFEST_NAME);

const graphs: Record<string, GraphDescriptor> = {
  human: serialize(human),
  repeater: serialize(repeater),
  structuredWorker: serialize(structuredWorker),
  specialist: serialize(specialist),
  worker: serialize(worker),
  looper: serialize(looper),
  joiner: serialize(joiner),
  content: serialize(content),
};

const manifest: GraphDescriptor = {
  title: "Agent Kit",
  description: "A collection of nodes for building Agent-like experiences.",
  version: "0.0.1",
  url: `https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/agent-kit/${MANIFEST_NAME}`,
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

await generate();
