/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EmbeddedBoardServer,
  isFromEmbeddedServer,
} from "@breadboard-ai/embedded-board-server";
import { BoardServer } from "@google-labs/breadboard";

import { a2 } from "./a2";

// Add new exports here.
import a2Descriptor from "./a2/bgl.json" with { type: "json" };
import audioGenerator from "./audio-generator/bgl.json" with { type: "json" };
import folio from "./folio/bgl.json" with { type: "json" };
import fileSystem from "./file-system/bgl.json" with { type: "json " };
import generate from "./generate/bgl.json" with { type: "json" };
import generateText from "./generate-text/bgl.json" with { type: "json" };
import gmail from "./gmail/bgl.json" with { type: "json" };
import goOverList from "./go-over-list/bgl.json" with { type: "json" };
import googleDrive from "./google-drive/bgl.json" with { type: "json" };
import mcp from "./mcp/bgl.json" with { type: "json" };
import saveOutputs from "./save-outputs/bgl.json" with { type: "json" };
import tools from "./tools/bgl.json" with { type: "json" };
import videoGenerator from "./video-generator/bgl.json" with { type: "json" };
import musicGenerator from "./music-generator/bgl.json" with { type: "json" };
import deepResearch from "./deep-research/bgl.json" with { type: "json" };

import { createBgl } from "./create-bgl";

export { createA2Server, isA2 };
export { createA2ModuleFactory } from "./runnable-module-factory";

const SERVER_NAME = "a2";

function isA2(url: URL | string | undefined) {
  return isFromEmbeddedServer(url, SERVER_NAME);
}

function createA2Server(): BoardServer {
  return new EmbeddedBoardServer(
    "A2",
    SERVER_NAME,
    new Map([
      ["a2", createBgl(a2Descriptor, a2["a2"])],
      ["audio-generator", createBgl(audioGenerator, a2["audio-generator"])],
      ["file-system", createBgl(fileSystem, a2["file-system"])],
      ["folio", createBgl(folio, a2["folio"])],
      ["generate", createBgl(generate, a2["generate"])],
      ["generate-text", createBgl(generateText, a2["generate-text"])],
      ["gmail", createBgl(gmail, a2["gmail"])],
      ["go-over-list", createBgl(goOverList, a2["go-over-list"])],
      ["google-drive", createBgl(googleDrive, a2["google-drive"])],
      ["mcp", createBgl(mcp, a2["mcp"])],
      ["save-outputs", createBgl(saveOutputs, a2["save-outputs"])],
      ["tools", createBgl(tools, a2["tools"])],
      ["video-generator", createBgl(videoGenerator, a2["video-generator"])],
      ["music-generator", createBgl(musicGenerator, a2["music-generator"])],
      ["deep-research", createBgl(deepResearch, a2["deep-research"])],
    ])
  );
}
