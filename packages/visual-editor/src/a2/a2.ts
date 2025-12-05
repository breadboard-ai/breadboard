/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exports as a2Exports } from "./a2/index";
import { exports as agentExports } from "./agent/index";
import { exports as audioGeneratorExports } from "./audio-generator/index";
import { exports as deepResearchExports } from "./deep-research/index";
import { exports as generateExports } from "./generate/index";
import { exports as generateTextExports } from "./generate-text/index";
import { exports as goOverListExports } from "./go-over-list/index";
import { exports as googleDriveExports } from "./google-drive/index";
import { exports as musicGeneratorExports } from "./music-generator/index";
import { exports as toolsExports } from "./tools/index";
import { exports as videoGeneratorExports } from "./video-generator/index";
import { exports as autonameExports } from "./autoname/index";

export const a2 = {
  a2: a2Exports,
  agent: agentExports,
  "audio-generator": audioGeneratorExports,
  autoname: autonameExports,
  generate: generateExports,
  "generate-text": generateTextExports,
  "go-over-list": goOverListExports,
  "google-drive": googleDriveExports,
  tools: toolsExports,
  "video-generator": videoGeneratorExports,
  "music-generator": musicGeneratorExports,
  "deep-research": deepResearchExports,
};
