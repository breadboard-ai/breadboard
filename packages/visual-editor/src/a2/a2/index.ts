/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as a2Common from "./common.js";
import * as a2ConnectorManager from "./connector-manager.js";
import * as a2Gemini from "./gemini.js";
import * as a2GeminiPrompt from "./gemini-prompt.js";
import * as a2HtmlGenerator from "./html-generator.js";
import * as a2ImageEditor from "./image-editor.js";
import * as a2ImageGenerator from "./image-generator.js";
import * as a2ImageUtils from "./image-utils.js";
import * as a2Introducer from "./introducer.js";

import * as a2Output from "./output.js";
import * as a2RenderOutputs from "./render-outputs.js";
import * as a2Settings from "./settings.js";
import * as a2StepExecutor from "./step-executor.js";
import * as a2Template from "./template.js";
import * as a2ToolManager from "./tool-manager.js";
import * as a2Utils from "./utils.js";

export const exports = {
  common: a2Common,
  "connector-manager": a2ConnectorManager,
  "gemini-prompt": a2GeminiPrompt,
  gemini: a2Gemini,
  "html-generator": a2HtmlGenerator,
  "image-editor": a2ImageEditor,
  "image-generator": a2ImageGenerator,
  "image-utils": a2ImageUtils,
  introducer: a2Introducer,

  output: a2Output,
  "render-outputs": a2RenderOutputs,
  settings: a2Settings,
  "step-executor": a2StepExecutor,
  template: a2Template,
  "tool-manager": a2ToolManager,
  utils: a2Utils,
};
