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

import { bgl as a2Bgl } from "./a2/index";
import { bgl as audioGeneratorBgl } from "./audio-generator/index";
import { bgl as deepResearchBgl } from "./deep-research/index";
import { bgl as fileSystemBgl } from "./file-system/index";
import { bgl as folioBgl } from "./folio/index";
import { bgl as generateTextBgl } from "./generate-text/index";
import { bgl as generateBgl } from "./generate/index";
import { bgl as gmailBgl } from "./gmail/index";
import { bgl as goOverListBgl } from "./go-over-list/index";
import { bgl as googleDriveBgl } from "./google-drive/index";
import { bgl as mcpBgl } from "./mcp/index";
import { bgl as musicGeneratorBgl } from "./music-generator/index";
import { bgl as saveOutputsBgl } from "./save-outputs/index";
import { bgl as toolsBgl } from "./tools/index";
import { bgl as videoGeneratorBgl } from "./video-generator/index";

export { createA2ModuleFactory } from "./runnable-module-factory";
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
      ["audio-generator", audioGeneratorBgl],
      ["file-system", fileSystemBgl],
      ["folio", folioBgl],
      ["generate", generateBgl],
      ["generate-text", generateTextBgl],
      ["gmail", gmailBgl],
      ["go-over-list", goOverListBgl],
      ["google-drive", googleDriveBgl],
      ["mcp", mcpBgl],
      ["save-outputs", saveOutputsBgl],
      ["tools", toolsBgl],
      ["video-generator", videoGeneratorBgl],
      ["music-generator", musicGeneratorBgl],
      ["deep-research", deepResearchBgl],
    ])
  );
}
