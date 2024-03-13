/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { fileURLToPath } from "url";

import { KitManifest } from "@google-labs/breadboard";

import { writeFile } from "fs/promises";

const MANIFEST_NAME = "team.kit.json";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(MODULE_DIR, "..");
const MANIFEST_PATH = path.join(ROOT_DIR, MANIFEST_NAME);

const manifest: KitManifest = {
  title: "Team Kit",
  description:
    "A Breadboard kit containing nodes to organize teams of synthetic workers",
  version: "0.0.1",
  url: `https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/team-kit/${MANIFEST_NAME}`,
  nodes: {},
};

const generate = async () => {
  const json = JSON.stringify(manifest, null, 2);
  return writeFile(MANIFEST_PATH, json);
};

await generate();
