/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphEditingActions } from "../runnable-module-factory.js";
import type { FunctionGroupConfigurator } from "./loop.js";
import { getGraphEditingFunctionGroup } from "./functions/graph-editing.js";
import { getChatFunctionGroup, CHAT_LOG_PATH } from "./functions/chat.js";
import { TaskTreeManager } from "./task-tree-manager.js";

export { createGraphEditingConfigurator };

/**
 * Creates a FunctionGroupConfigurator for the graph editing agent.
 * This is a separate agent from the content generation agent —
 * following the same pattern as `createSimulatedUserConfigurator`.
 */
function createGraphEditingConfigurator(
  graphEditingActions: GraphEditingActions
): FunctionGroupConfigurator {
  return async (deps, flags) => {
    const groups = [];
    const taskTreeManager = new TaskTreeManager(deps.fileSystem);

    groups.push(getGraphEditingFunctionGroup({ graphEditingActions }));

    if (flags.uiType === "chat") {
      deps.fileSystem.addSystemFile(CHAT_LOG_PATH, () =>
        JSON.stringify(deps.ui.chatLog)
      );
      groups.push(
        getChatFunctionGroup({
          chatManager: deps.ui,
          translator: deps.translator,
          taskTreeManager,
        })
      );
    }

    return groups;
  };
}
