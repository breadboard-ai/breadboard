/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BBRTTool } from "../tools/tool.js";

export interface ToolProvider {
  name: string;
  tools(): Promise<BBRTTool[]>;
}
