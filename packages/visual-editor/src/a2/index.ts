/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardServer } from "@breadboard-ai/types";
import { bgl as a2Bgl } from "./a2/index.js";
import { bgl as agentBgl } from "./agent/index.js";
import { bgl as audioGeneratorBgl } from "./audio-generator/index.js";
import { bgl as autonameBgl } from "./autoname/index.js";
import { bgl as deepResearchBgl } from "./deep-research/index.js";
import {
  EmbeddedBoardServer,
  isFromEmbeddedServer,
} from "./embedded-board-server.js";
import { bgl as generateTextBgl } from "./generate-text/index.js";
import { bgl as generateBgl } from "./generate/index.js";
import { bgl as goOverListBgl } from "./go-over-list/index.js";
import { bgl as googleDriveBgl } from "./google-drive/index.js";
import { bgl as musicGeneratorBgl } from "./music-generator/index.js";
import { bgl as toolsBgl } from "./tools/index.js";
import { bgl as videoGeneratorBgl } from "./video-generator/index.js";

export { createA2ModuleFactory } from "./runnable-module-factory.js";
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
      ["a2", a2Bgl],
      ["agent", agentBgl],
      ["audio-generator", audioGeneratorBgl],
      ["autoname", autonameBgl],
      ["generate", generateBgl],
      ["generate-text", generateTextBgl],
      ["go-over-list", goOverListBgl],
      ["google-drive", googleDriveBgl],
      ["tools", toolsBgl],
      ["video-generator", videoGeneratorBgl],
      ["music-generator", musicGeneratorBgl],
      ["deep-research", deepResearchBgl],
    ])
  );
}
