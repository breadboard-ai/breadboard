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

export class BBRTAppState {
  readonly secrets = new IndexedDBSettingsSecrets();
  readonly drivers = [
    new GeminiDriver(() => this.secrets.getSecret("GEMINI_API_KEY")),
    new OpenAiDriver(() => this.secrets.getSecret("OPENAI_API_KEY")),
  ];
  readonly activeDriver = new Signal.State<BBRTDriver>(this.drivers[0]!);
  readonly toolProviders = new SignalArray<ToolProvider>();
  readonly activeTools = new SignalSet<BBRTTool>();
  readonly conversation = new BBRTConversation(
    this.activeDriver,
    this.activeTools
  );
  readonly sidePanelOpen = new Signal.State<boolean>(true);
}
