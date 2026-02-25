/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AppScreen, ConsoleEntry, Outcome } from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { A2UIClient } from "./a2ui/client.js";
import { A2UIClientWorkItem } from "./a2ui/client-work-item.js";
import { A2UIAppScreenOutput } from "./a2ui/app-screen-output.js";
import type { A2UIClientEventMessage } from "./a2ui/schemas.js";
import type { v0_8 } from "../../a2ui/index.js";
import type { FromPidginMessagesResult } from "./pidgin-translator.js";

export { A2UIInteraction };

/**
 * Standalone A2UI rendering core — no pidgin, no file system.
 *
 * Satisfies the `UIRenderer` interface from `choice-presenter.ts`:
 * - `renderUserInterface(messages)` — creates a WorkItem + app screen
 *   output, feeds the A2UI component tree, and flips to interactive mode.
 * - `awaitUserInput()` — waits for the user to interact with the
 *   rendered A2UI surface and returns their response.
 *
 * Used directly by the remote path (where translation is done server-side)
 * and indirectly by `AgentUI` (which adds pidgin translation on top).
 */
class A2UIInteraction {
  #client: A2UIClient;
  #workItem: A2UIClientWorkItem | undefined;
  readonly #consoleEntry: ConsoleEntry | undefined;
  readonly #appScreen: AppScreen | undefined;

  constructor(consoleEntry?: ConsoleEntry, appScreen?: AppScreen) {
    this.#consoleEntry = consoleEntry;
    this.#appScreen = appScreen;
    this.#client = new A2UIClient();
  }

  /**
   * Renders A2UI messages that have no pidgin file references.
   * Satisfies the `UIRenderer` interface for `ChoicePresenter`.
   */
  renderUserInterface(
    messages: v0_8.Types.ServerToClientMessage[],
    title: string = "A2UI",
    icon: string = "web"
  ): Outcome<void> {
    return this.#render({ messages, remap: new Map() }, title, icon);
  }

  /**
   * Renders A2UI messages that have been translated from pidgin.
   * Preserves the remap for translating user responses back to pidgin
   * paths. Used by `AgentUI`.
   */
  renderTranslated(
    updates: FromPidginMessagesResult,
    title: string = "A2UI",
    icon: string = "web"
  ): Outcome<void> {
    return this.#render(updates, title, icon);
  }

  #render(
    updates: FromPidginMessagesResult,
    title: string,
    icon: string
  ): Outcome<void> {
    // Finish the previous work item if it exists.
    this.#workItem?.finish();

    if (!this.#consoleEntry) {
      return err(`Unable to create UI: Console is not available`);
    }

    const outputId = crypto.randomUUID();

    // Create a fresh client so this interaction preserves its own state.
    this.#client = new A2UIClient();

    // Create a new work item for the console view.
    this.#workItem = new A2UIClientWorkItem(this.#client, title, icon);
    this.#consoleEntry.work.set(outputId, this.#workItem);

    // Create a new app screen output for the app view.
    if (this.#appScreen) {
      const appScreenOutput = new A2UIAppScreenOutput(this.#client);
      this.#appScreen.outputs.set(outputId, appScreenOutput);
      this.#appScreen.last = appScreenOutput;
      this.#appScreen.type = "a2ui";
    }

    // Feed the updates to the client and activate the work item.
    this.#client.processUpdates(updates);
    this.#workItem.renderUserInterface();
  }

  async awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    if (!this.#workItem) {
      return err(`Unable to await user input: No active A2UI interaction`);
    }
    if (!this.#appScreen) {
      return err(`Unable to await user input: App screen is not available`);
    }

    this.#appScreen.status = "interactive";
    const result = await this.#client.awaitUserInput();
    this.#appScreen.status = "processing";
    return result;
  }

  finish(): void {
    this.#workItem?.finish();
  }
}
