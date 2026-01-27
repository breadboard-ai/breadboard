/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryManager } from "./types.js";
import {
  SheetManager,
  SheetManagerConfig,
} from "../google-drive/sheet-manager.js";
import { memorySheetGetter } from "../google-drive/memory-sheet-getter.js";

export { AgentContext };
export type { AgentContextConfig };

type AgentContextConfig = SheetManagerConfig;

class AgentContext {
  readonly memoryManager: MemoryManager;

  constructor(config: AgentContextConfig) {
    this.memoryManager = new SheetManager(config, memorySheetGetter(config));
  }
}
