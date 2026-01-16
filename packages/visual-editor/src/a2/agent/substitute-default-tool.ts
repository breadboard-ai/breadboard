/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolParamPart } from "../a2/template.js";

export { substituteDefaultTool };

const DEFAULT_TOOL_SUBSTITUTIONS = new Map([
  ["embed://a2/tools.bgl.json#module:search-web", "Google Search grounding"],
  ["embed://a2/tools.bgl.json#module:search-maps", "Google Maps grounding"],
  ["embed://a2/tools.bgl.json#module:get-webpage", "URL context retrieval"],
  ["embed://a2/tools.bgl.json#module:get-weather", "Google Search grounding"],
  [
    "embed://a2/tools.bgl.json#module:code-execution",
    "generate and execute code",
  ],
]);

function substituteDefaultTool(param: ToolParamPart): string | null {
  return DEFAULT_TOOL_SUBSTITUTIONS.get(param.path) ?? null;
}
