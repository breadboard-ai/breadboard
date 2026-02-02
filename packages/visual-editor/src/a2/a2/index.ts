/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as a2AudioGenerator from "./audio-generator.js";
import * as a2CombineOutputs from "./combine-outputs.js";
import * as a2Common from "./common.js";
import * as a2ConnectorManager from "./connector-manager.js";
import * as a2Entry from "./entry.js";
import * as a2ForEach from "./for-each.js";
import * as a2Gemini from "./gemini.js";
import * as a2GeminiPrompt from "./gemini-prompt.js";
import * as a2HtmlGenerator from "./html-generator.js";
import * as a2ImageEditor from "./image-editor.js";
import * as a2ImageGenerator from "./image-generator.js";
import * as a2ImageUtils from "./image-utils.js";
import * as a2Introducer from "./introducer.js";
import * as a2MakeCode from "./make-code.js";
import * as a2Output from "./output.js";
import * as a2RenderOutputs from "./render-outputs.js";
import * as a2Researcher from "./researcher.js";
import * as a2Settings from "./settings.js";
import * as a2StepExecutor from "./step-executor.js";
import * as a2Template from "./template.js";
import * as a2TextEntry from "./text-entry.js";
import * as a2TextMain from "./text-main.js";
import * as a2ToolManager from "./tool-manager.js";
import * as a2Utils from "./utils.js";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl.js";

export const exports = {
  "audio-generator": a2AudioGenerator,
  "combine-outputs": a2CombineOutputs,
  common: a2Common,
  "connector-manager": a2ConnectorManager,
  entry: a2Entry,
  "for-each": a2ForEach,
  "gemini-prompt": a2GeminiPrompt,
  gemini: a2Gemini,
  "html-generator": a2HtmlGenerator,
  "image-editor": a2ImageEditor,
  "image-generator": a2ImageGenerator,
  "image-utils": a2ImageUtils,
  introducer: a2Introducer,
  "make-code": a2MakeCode,
  output: a2Output,
  "render-outputs": a2RenderOutputs,
  researcher: a2Researcher,
  settings: a2Settings,
  "step-executor": a2StepExecutor,
  template: a2Template,
  "text-entry": a2TextEntry,
  "text-main": a2TextMain,
  "tool-manager": a2ToolManager,
  utils: a2Utils,
};

export const bgl = createBgl(descriptor, exports);
