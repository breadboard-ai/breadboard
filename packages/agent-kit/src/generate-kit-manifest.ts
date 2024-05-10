/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { fileURLToPath } from "url";

import { KitManifest } from "@google-labs/breadboard";

import worker from "./boards/worker.js";
import human from "./boards/human.js";
import repeater from "./boards/repeater.js";
import structuredWorker from "./boards/structured-worker.js";
import toolWorker from "./boards/tool-worker.js";
import { writeFile } from "fs/promises";
import specialist from "./boards/specialist.js";
import looper from "./boards/looper.js";

const MANIFEST_NAME = "agent.kit.json";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(MODULE_DIR, "..");
const MANIFEST_PATH = path.join(ROOT_DIR, MANIFEST_NAME);

const manifest: KitManifest = {
  title: "Agent Kit",
  description: "A collection of nodes for building Agent-like experiences.",
  version: "0.0.1",
  url: `https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/agent-kit/${MANIFEST_NAME}`,
  nodes: {
    human,
    repeater,
    structuredWorker,
    specialist,
    toolWorker,
    worker,
    looper,
  },
};

const generate = async () => {
  const json = JSON.stringify(manifest, null, 2);
  return writeFile(MANIFEST_PATH, json);
};

await generate();
