/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is a one-time migration script that generates `bgl.json` stubs
 * for each A2 `*.bgl.json` file and places it into the `src` directory
 * next to the TS source files.
 */

import a2 from "../bgl/a2.bgl.json" with { type: "json" };
import audioGenerator from "../bgl/audio-generator.bgl.json" with { type: "json" };
import deepResearch from "../bgl/deep-research.bgl.json" with { type: "json" };
import folio from "../bgl/folio.bgl.json" with { type: "json" };
import generateText from "../bgl/generate-text.bgl.json" with { type: "json" };
import generate from "../bgl/generate.bgl.json" with { type: "json" };
import gmail from "../bgl/gmail.bgl.json" with { type: "json" };
import goOverList from "../bgl/go-over-list.bgl.json" with { type: "json" };
import googleDrive from "../bgl/google-drive.bgl.json" with { type: "json" };
import mcp from "../bgl/mcp.bgl.json" with { type: "json" };
import musicGenerator from "../bgl/music-generator.bgl.json" with { type: "json" };
import saveOutputs from "../bgl/save-outputs.bgl.json" with { type: "json" };
import tools from "../bgl/tools.bgl.json" with { type: "json" };
import videoGenerator from "../bgl/video-generator.bgl.json" with { type: "json" };

import { writeFile } from "fs/promises";
import { join } from "path";

const ROOT_DIR = join(import.meta.dirname, "..");

const bgls = new Map<string, unknown>([
  ["a2", a2],
  ["audio-generator", audioGenerator],
  ["folio", folio],
  ["generate", generate],
  ["generate-text", generateText],
  ["gmail", gmail],
  ["go-over-list", goOverList],
  ["google-drive", googleDrive],
  ["mcp", mcp],
  ["save-outputs", saveOutputs],
  ["tools", tools],
  ["video-generator", videoGenerator],
  ["music-generator", musicGenerator],
  ["deep-research", deepResearch],
]);

await Promise.all(
  Array.from(bgls.entries()).map(([name, bgl]) => {
    (bgl as Record<string, unknown>)["modules"] = {};
    const json = JSON.stringify(bgl, null, 2);
    const path = join(ROOT_DIR, "bgl", "src", name, "bgl.json");
    return writeFile(path, json, "utf8");
  })
);
