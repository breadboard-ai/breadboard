/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { field } from "../../decorators/field.js";
import { RootController } from "../root-controller.js";
import { parseThought } from "../../../../a2/agent/thought-parser.js";
import type { ChatEntry } from "../../../types.js";

export { GraphEditingAgentController };

const GREETINGS = [
  "Hey there! What would you like to change?",
  "Hi! How can I help you with this Opal?",
  "What would you like me to do?",
  "Ready to help! What do you need?",
  "Hi! Tell me what you'd like to change.",
  "What can I do for you today?",
];

/**
 * Reactive state for the graph editing agent chat panel.
 *
 * Owns the chat log, panel visibility, and processing flags.
 * The UI component reads these fields via SignalWatcher for automatic
 * re-rendering. Mutations are performed by the service layer or
 * directly by the component for simple UI toggles.
 */
class GraphEditingAgentController extends RootController {
  @field({ deep: true })
  private accessor _entries: ChatEntry[] = [];

  @field()
  accessor open = false;

  @field()
  accessor waiting = false;

  @field()
  accessor processing = false;

  @field()
  accessor loopRunning = false;

  /**
   * The flow ID that the current loop was started for.
   * Used to detect graph changes and restart the loop.
   */
  @field()
  accessor currentFlow: string | null = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  get entries(): readonly ChatEntry[] {
    return this._entries;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  addMessage(role: "user" | "model" | "system", text: string) {
    this._entries = [...this._entries, { kind: "message", role, text }];
  }

  addThought(text: string) {
    const parsed = parseThought(text);
    const last = this._entries[this._entries.length - 1];
    if (last && last.kind === "thought-group") {
      last.thoughts.push(parsed);
      // Trigger reactive update
      this._entries = [...this._entries];
    } else {
      this._entries = [
        ...this._entries,
        { kind: "thought-group", thoughts: [parsed] },
      ];
    }
  }

  /**
   * Show a random greeting if no entries exist yet.
   */
  showGreeting() {
    if (this._entries.length > 0) return;
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    this.addMessage("model", greeting);
  }

  /**
   * Reset all state (e.g. when navigating to a different graph).
   */
  reset() {
    this._entries = [];
    this.open = false;
    this.waiting = false;
    this.processing = false;
    this.loopRunning = false;
    this.currentFlow = null;
  }
}
