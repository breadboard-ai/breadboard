/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as a2AudioGenerator from "./audio-generator";
import * as a2CombineOutputs from "./combine-outputs";
import * as a2Common from "./common";
import * as a2ConnectorManager from "./connector-manager";
import * as a2Entry from "./entry";
import * as a2ForEach from "./for-each";
import * as a2Gemini from "./gemini";
import * as a2GeminiPrompt from "./gemini-prompt";
import * as a2HtmlGenerator from "./html-generator";
import * as a2ImageEditor from "./image-editor";
import * as a2ImageGenerator from "./image-generator";
import * as a2ImageUtils from "./image-utils";
import * as a2Introducer from "./introducer";
import * as a2Lists from "./lists";
import * as a2MakeCode from "./make-code";
import * as a2Output from "./output";
import * as a2RenderOutputs from "./render-outputs";
import * as a2Researcher from "./researcher";
import * as a2Rpc from "./rpc";
import * as a2Settings from "./settings";
import * as a2StepExecutor from "./step-executor";
import * as a2Template from "./template";
import * as a2TextEntry from "./text-entry";
import * as a2TextMain from "./text-main";
import * as a2ToolManager from "./tool-manager";
import * as a2Utils from "./utils";

import descriptor from "./bgl.json" with { type: "json" };
import { createBgl } from "../create-bgl";

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
  lists: a2Lists,
  "make-code": a2MakeCode,
  output: a2Output,
  "render-outputs": a2RenderOutputs,
  researcher: a2Researcher,
  rpc: a2Rpc,
  settings: a2Settings,
  "step-executor": a2StepExecutor,
  template: a2Template,
  "text-entry": a2TextEntry,
  "text-main": a2TextMain,
  "tool-manager": a2ToolManager,
  utils: a2Utils,
};

export const bgl = createBgl(descriptor, exports);
