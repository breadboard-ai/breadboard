/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {SignalArray} from 'signal-utils/array';
import type {BBRTTool} from '../tools/tool.js';

export interface ToolProvider {
  name: string;
  tools(): SignalArray<BBRTTool>;
}
