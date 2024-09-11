/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { fileURLToPath } from "url";

import { GraphDescriptor, KitManifest } from "@google-labs/breadboard";

import worker from "./boards/worker.js";
import human from "./boards/human.js";
import repeater from "./boards/repeater.js";
import structuredWorker from "./boards/structured-worker.js";
import toolWorker from "./boards/tool-worker.js";
import { writeFile } from "fs/promises";
import specialist from "./boards/specialist.js";
import looper from "./boards/looper.js";
import joiner from "./boards/joiner.js";
import { serialize } from "@breadboard-ai/build";
import content from "../bgl/content.bgl.json" with { type: "application/json" };

const MANIFEST_NAME = "agent.kit.json";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(MODULE_DIR, "..");
const BOARDS_DIR = path.join(ROOT_DIR, "boards");
const MANIFEST_PATH = path.join(ROOT_DIR, MANIFEST_NAME);

const manifest: KitManifest = {
  title: "Agent Kit",
  description: "A collection of nodes for building Agent-like experiences.",
  version: "0.0.1",
  url: `https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/agent-kit/${MANIFEST_NAME}`,
  nodes: {
    human: serialize(human),
    repeater: serialize(repeater),
    structuredWorker,
    specialist,
    toolWorker,
    worker: serialize(worker),
    looper: serialize(looper),
    joiner: serialize(joiner),
    content: content as GraphDescriptor,
  },
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
