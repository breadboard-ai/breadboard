/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EmbeddedBoardServer,
  isFromEmbeddedServer,
} from "@breadboard-ai/embedded-board-server";
import { BoardServer, GraphDescriptor } from "@google-labs/breadboard";

// Add new exports here.
import a2 from "../bgl/a2.bgl.json" with { type: "json" };
import audioGenerator from "../bgl/audio-generator.bgl.json" with { type: "json" };
import folio from "../bgl/folio.bgl.json" with { type: "json" };
import generate from "../bgl/generate.bgl.json" with { type: "json" };
import gmail from "../bgl/gmail.bgl.json" with { type: "json" };
import goOverList from "../bgl/go-over-list.bgl.json" with { type: "json" };
import googleDrive from "../bgl/google-drive.bgl.json" with { type: "json" };
import mcp from "../bgl/mcp.bgl.json" with { type: "json" };
import saveOutputs from "../bgl/save-outputs.bgl.json" with { type: "json" };
import tools from "../bgl/tools.bgl.json" with { type: "json" };
import videoGenerator from "../bgl/video-generator.bgl.json" with { type: "json" };

export { createA2Server, isA2 };

const SERVER_NAME = "a2";

function isA2(url: URL | string | undefined) {
  return isFromEmbeddedServer(url, SERVER_NAME);
}

function createA2Server(): BoardServer {
  return new EmbeddedBoardServer(
    "A2",
    SERVER_NAME,
    new Map([
      ["a2", a2 as GraphDescriptor],
      ["audio-generator", audioGenerator as GraphDescriptor],
      ["folio", folio as GraphDescriptor],
      ["generate", generate as GraphDescriptor],
      ["gmail", gmail as GraphDescriptor],
      ["go-over-list", goOverList as GraphDescriptor],
      ["google-drive", googleDrive as GraphDescriptor],
      ["mcp", mcp as GraphDescriptor],
      ["save-outputs", saveOutputs as GraphDescriptor],
      ["tools", tools as GraphDescriptor],
      ["video-generator", videoGenerator as GraphDescriptor],
    ])
  );
}
