/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import type { FunctionGroupConfigurator } from "./loop.js";
import { getGoogleDriveFunctionGroup } from "./functions/google-drive.js";
import { getGenerateFunctionGroup } from "./functions/generate.js";
import { getSystemFunctionGroup } from "./functions/system.js";
import { getMemoryFunctionGroup } from "./functions/memory.js";
import { CHAT_LOG_PATH, getChatFunctionGroup } from "./functions/chat.js";
import { getA2UIFunctionGroup } from "./functions/a2ui.js";
import { getNoUiFunctionGroup } from "./functions/no-ui.js";
import { TaskTreeManager } from "./task-tree-manager.js";
import { Generators } from "./types.js";

export { createAgentConfigurator };

function createAgentConfigurator(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  generators: Generators
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
        caps,
        moduleArgs,
        translator: deps.translator,
        taskTreeManager,
        generators,
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

    if (flags.uiType === "a2ui") {
      const a2uiFunctionGroup = await getA2UIFunctionGroup({
        caps,
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
