/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";
import { SignalArray } from "signal-utils/array";
import { SignalSet } from "signal-utils/set";
import type { BBRTDriver } from "./drivers/driver-interface.js";
import { GeminiDriver } from "./drivers/gemini.js";
import { OpenAiDriver } from "./drivers/openai.js";
import { BBRTConversation } from "./llm/conversation.js";
import { IndexedDBSettingsSecrets } from "./secrets/indexed-db-secrets.js";
import type { ToolProvider } from "./tools/tool-provider.js";
import type { BBRTTool } from "./tools/tool.js";

export interface SerializedBBRTAppState {
  activeDriverName: string;
  activeToolIds: string[];
  sidePanelOpen: boolean;
  // TODO(aomarks) Conversation turns.
}

export class BBRTAppState {
  readonly secrets = new IndexedDBSettingsSecrets();
  readonly drivers = [
    new GeminiDriver(() => this.secrets.getSecret("GEMINI_API_KEY")),
    new OpenAiDriver(() => this.secrets.getSecret("OPENAI_API_KEY")),
  ];
  readonly activeDriver = new Signal.State<BBRTDriver>(this.drivers[0]!);
  readonly toolProviders = new SignalArray<ToolProvider>();
  readonly activeTools = new SignalSet<BBRTTool>();
  readonly sidePanelOpen = new Signal.State<boolean>(true);
  readonly conversation = new BBRTConversation(
    this.activeDriver,
    this.activeTools
  );

  serialize(): SerializedBBRTAppState {
    return {
      activeDriverName: this.activeDriver.get().name,
      activeToolIds: Array.from(this.activeTools).map(
        (tool) => tool.metadata.id
      ),
      sidePanelOpen: this.sidePanelOpen.get(),
    };
  }

  restore(serialized: SerializedBBRTAppState) {
    // TODO(aomarks) Inefficient. Drivers should be in a map.
    const driver = this.drivers.find(
      (driver) => driver.name === serialized.activeDriverName
    );
    if (driver !== undefined) {
      this.activeDriver.set(driver);
    } else {
      console.error(
        `Could not find driver ${JSON.stringify(serialized.activeDriverName)}`
      );
    }

    // TODO(aomarks) Inefficient. All available tools should be in a map.
    const activeTools = new Set(serialized.activeToolIds);
    for (const toolProvider of this.toolProviders) {
      for (const tool of toolProvider.tools()) {
        if (activeTools.has(tool.metadata.id)) {
          this.activeTools.add(tool);
        }
      }
    }

    this.sidePanelOpen.set(serialized.sidePanelOpen);
  }
}
