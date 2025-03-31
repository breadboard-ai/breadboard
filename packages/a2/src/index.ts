/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmbeddedBoardServer } from "@breadboard-ai/embedded-board-server";
import { BoardServer, GraphDescriptor } from "@google-labs/breadboard";

// Add new exports here.
import a2 from "../bgl/a2.bgl.json" with { type: "json" };
import audioGenerator from "../bgl/audio-generator.bgl.json" with { type: "json" };
import folio from "../bgl/folio.bgl.json" with { type: "json" };
import gmail from "../bgl/gmail.bgl.json" with { type: "json" };
import goOverList from "../bgl/go-over-list.bgl.json" with { type: "json" };
import saveOutputs from "../bgl/save-outputs.bgl.json" with { type: "json" };
import tools from "../bgl/tools.bgl.json" with { type: "json" };
import videoGenerator from "../bgl/video-generator.bgl.json" with { type: "json" };

export { createA2Server };

// Increment this version to reload BGL in Visual Editor.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VERSION = 1;

function createA2Server(): BoardServer {
  return new EmbeddedBoardServer(
    "A2",
    "std",
    new Map([
      ["a2", a2 as GraphDescriptor],
      ["audio-generator", audioGenerator as GraphDescriptor],
      ["folio", folio as GraphDescriptor],
      ["gmail", gmail as GraphDescriptor],
      ["go-over-list", goOverList as GraphDescriptor],
      ["save-outputs", saveOutputs as GraphDescriptor],
      ["tools", tools as GraphDescriptor],
      ["video-generator", videoGenerator as GraphDescriptor],
    ])
  );
}
