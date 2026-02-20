/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import type { FunctionGroupConfigurator } from "./types.js";
import { getGoogleDriveFunctionGroup } from "./functions/google-drive.js";
import { getGenerateFunctionGroup } from "./functions/generate.js";
import { getSystemFunctionGroup } from "./functions/system.js";
import { getMemoryFunctionGroup } from "./functions/memory.js";
import { getNotebookLMFunctionGroup } from "./functions/notebooklm.js";
import { CHAT_LOG_PATH, getChatFunctionGroup } from "./functions/chat.js";
import { getA2UIFunctionGroup } from "./functions/a2ui.js";
import { getNoUiFunctionGroup } from "./functions/no-ui.js";
import { TaskTreeManager } from "./task-tree-manager.js";
import { Generators } from "./types.js";

export { createAgentConfigurator };

import type { AgentEventSink } from "./agent-event-sink.js";

function createAgentConfigurator(
  moduleArgs: A2ModuleArgs,
  generators: Generators,
  sink: AgentEventSink
): FunctionGroupConfigurator {
  return async (deps, flags) => {
    const groups = [];
    const taskTreeManager = new TaskTreeManager(deps.fileSystem);

    groups.push(
      getSystemFunctionGroup({
        fileSystem: deps.fileSystem,
        translator: deps.translator,
        taskTreeManager,
        successCallback: flags.onSuccess,
        failureCallback: flags.onFailure,
      })
    );

    groups.push(
      getGenerateFunctionGroup({
        fileSystem: deps.fileSystem,
        moduleArgs,
        translator: deps.translator,
        taskTreeManager,
        generators,
        sink,
      })
    );

    if (flags.useMemory) {
      groups.push(
        getMemoryFunctionGroup({
          context: moduleArgs.context,
          translator: deps.translator,
          fileSystem: deps.fileSystem,
          memoryManager: moduleArgs.agentContext.memoryManager,
          taskTreeManager,
        })
      );
    }

    const runtimeFlags = await moduleArgs.context.flags?.flags();
    if (flags.useNotebookLM && runtimeFlags?.enableNotebookLm) {
      groups.push(
        getNotebookLMFunctionGroup({
          notebookLmApiClient: moduleArgs.notebookLmApiClient,
          fileSystem: deps.fileSystem,
          taskTreeManager,
        })
      );
    }

    if (flags.uiType === "a2ui") {
      const a2uiFunctionGroup = await getA2UIFunctionGroup({
        moduleArgs,
        fileSystem: deps.fileSystem,
        translator: deps.translator,
        ui: deps.ui,
        uiPrompt: flags.uiPrompt,
        objective: flags.objective,
        params: flags.params,
      });
      if (!ok(a2uiFunctionGroup)) return a2uiFunctionGroup;
      groups.push(a2uiFunctionGroup);
    } else if (flags.uiType === "chat") {
      deps.fileSystem.addSystemFile(CHAT_LOG_PATH, () =>
        JSON.stringify(deps.ui.chatLog)
      );
      if (flags.useMemory) {
        const memoryManager = moduleArgs.agentContext.memoryManager;
        deps.ui.setMemoryManager(memoryManager, moduleArgs.context);
        // Ensure the __chat_log__ sheet exists, then load historical entries.
        const ensured = await memoryManager.ensureSystemSheet(
          moduleArgs.context,
          "__chat_log__",
          ["timestamp", "session_id", "role", "content"]
        );
        if (ok(ensured)) {
          const sheetData = await memoryManager.readSheet(moduleArgs.context, {
            range: "__chat_log__!A:D",
          });
          if (ok(sheetData) && "values" in sheetData && sheetData.values) {
            deps.ui.seedChatLog(sheetData.values);
          }
        }
      }
      groups.push(
        getChatFunctionGroup({
          chatManager: deps.ui,
          translator: deps.translator,
          taskTreeManager,
        })
      );
    } else {
      groups.push(getNoUiFunctionGroup());
    }

    const enableGoogleDriveTools = await moduleArgs.context.flags?.flags();
    if (enableGoogleDriveTools) {
      groups.push(
        getGoogleDriveFunctionGroup({
          fileSystem: deps.fileSystem,
          moduleArgs,
        })
      );
    }

    return groups;
  };
}
