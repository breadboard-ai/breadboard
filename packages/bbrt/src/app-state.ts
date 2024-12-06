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
import { restoreTurns } from "./llm/conversation-restore.js";
import type { SerializableBBRTTurn } from "./llm/conversation-serialization-types.js";
import { serializeTurns } from "./llm/conversation-serialization.js";
import { BBRTConversation } from "./llm/conversation.js";
import { IndexedDBSettingsSecrets } from "./secrets/indexed-db-secrets.js";
import type { ToolProvider } from "./tools/tool-provider.js";
import type { BBRTTool } from "./tools/tool.js";

export interface SerializedBBRTAppState {
  activeDriverName: string;
  activeToolIds: string[];
  sidePanelOpen: boolean;
  conversationTurns: SerializableBBRTTurn[];
}

export class BBRTAppState {
  readonly secrets = new IndexedDBSettingsSecrets();
  readonly drivers = [
    new GeminiDriver(() => this.secrets.getSecret("GEMINI_API_KEY")),
    new OpenAiDriver(() => this.secrets.getSecret("OPENAI_API_KEY")),
  ];
  readonly activeDriver = new Signal.State<BBRTDriver>(this.drivers[0]!);
  readonly toolProviders = new SignalArray<ToolProvider>();
  readonly availableTools = new SignalSet<BBRTTool>();
  readonly activeToolIds = new SignalSet<string>();
  readonly activeTools = new Signal.Computed<Set<BBRTTool>>(() => {
    const active = new Set<BBRTTool>();
    // TODO(aomarks) Inefficient. Available tools should be a map.
    for (const tool of this.availableTools) {
      if (this.activeToolIds.has(tool.metadata.id)) {
        active.add(tool);
      }
    }
    return active;
  });
  readonly sidePanelOpen = new Signal.State<boolean>(true);
  readonly conversation = new BBRTConversation(
    this.activeDriver,
    this.activeTools
  );

  serialize(): SerializedBBRTAppState {
    return {
      activeDriverName: this.activeDriver.get().name,
      activeToolIds: [...this.activeToolIds],
      sidePanelOpen: this.sidePanelOpen.get(),
      conversationTurns: serializeTurns(this.conversation.turns),
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

    this.activeToolIds.clear();
    for (const id of serialized.activeToolIds) {
      this.activeToolIds.add(id);
    }

    this.sidePanelOpen.set(serialized.sidePanelOpen);

    this.conversation.turns.length = 0;
    this.conversation.turns.push(
      ...restoreTurns(serialized.conversationTurns, this.availableTools)
    );
  }
}
