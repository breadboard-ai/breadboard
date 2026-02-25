/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AppScreen,
  ConsoleEntry,
  LLMContent,
  OutputValues,
  Schema,
  WorkItem,
} from "@breadboard-ai/types";

export { addChatOutput };

/**
 * Renders an agent → user chat message to the console and app screen.
 *
 * This is the shared rendering utility for displaying agent messages.
 * Both local (AgentUI) and remote (invokeRemoteAgent) paths use this
 * to avoid duplicating the WorkItem + AppScreen output pattern.
 */
function addChatOutput(
  message: LLMContent,
  consoleEntry?: ConsoleEntry,
  appScreen?: AppScreen
): void {
  const outputId = crypto.randomUUID();
  const schema = {
    properties: { message: { type: "object", behavior: ["llm-content"] } },
  } satisfies Schema;

  // Add to app screen outputs directly
  if (appScreen) {
    const entry = { schema, output: { message } as OutputValues };
    appScreen.outputs.set(outputId, entry);
    appScreen.last = entry;
  }

  // Add to console entry as a work item
  if (consoleEntry) {
    const product: WorkItem["product"] = new Map();
    product.set("message", message);
    consoleEntry.work.set(outputId, {
      title: "Response",
      start: 0,
      end: 0,
      elapsed: 0,
      awaitingUserInput: false,
      product,
    });
  }
}
