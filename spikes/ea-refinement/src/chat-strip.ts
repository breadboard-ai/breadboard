/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Chat Card — floating chat panel anchored bottom-right.
 *
 * Shows: chat messages, Refine button.
 * Preferences are displayed in the panel (left sidebar), not here.
 *
 * Flow:
 * - Typing + Enter sends to chat AND auto-triggers refinement if idle
 * - If a refinement is running, new messages queue and auto-trigger
 *   a follow-up when the current one completes
 */

import { chat } from "./pipeline.js";
import { AppFrame } from "./app-frame.js";
import { RefinementPanel } from "./refinement-panel.js";

export { ChatStrip };

interface ChatMessage {
  role: "user" | "assistant" | "system";
  text: string;
  action?: () => void;
}

class ChatStrip {
  #container: HTMLElement;
  #appFrame: AppFrame;
  #panel: RefinementPanel;

  #chatMessages: ChatMessage[] = [];
  #chatInput = "";
  #chatSending = false;
  #feedbackQueue: string[] = [];
  #lastFeedback = "";
  #lastLabel = "";

  constructor(
    container: HTMLElement,
    appFrame: AppFrame,
    panel: RefinementPanel
  ) {
    this.#container = container;
    this.#appFrame = appFrame;
    this.#panel = panel;

    // When a refinement completes, drain the queue.
    this.#panel.onRefineComplete = () => this.#drainQueue();

    // Re-render when panel state changes.
    this.#panel.onStateChange = () => this.#render();

    this.#render();
  }

  #render() {
    this.#container.innerHTML = "";
    this.#container.className = "chat-card";

    const hasBaseline = this.#appFrame.hasBaseline;
    const isWorking = this.#panel.isRefining || this.#panel.isGenerating;

    // ─── Chat Log ───────────────────────────────────────────────────
    const chatLog = el("div", "chat-log");

    if (this.#chatMessages.length === 0) {
      const hint = el("div", "chat-hint");
      hint.textContent = hasBaseline
        ? "What would you change?"
        : "Generate a baseline, then share feedback here.";
      chatLog.appendChild(hint);
    }

    for (const msg of this.#chatMessages) {
      const bubble = el("div", `chat-bubble ${msg.role}`);
      bubble.textContent = msg.text;

      if (msg.action) {
        bubble.classList.add("chat-action");
        bubble.addEventListener("click", () => {
          // Remove this action bubble after clicking
          const idx = this.#chatMessages.indexOf(msg);
          if (idx !== -1) this.#chatMessages.splice(idx, 1);
          msg.action!();
        });
      }

      chatLog.appendChild(bubble);
    }

    this.#container.appendChild(chatLog);

    requestAnimationFrame(() => {
      chatLog.scrollTop = chatLog.scrollHeight;
    });

    // ─── Input Row ──────────────────────────────────────────────────
    const inputRow = el("div", "chat-input-row");

    const input = el("input", "chat-input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = "Describe what you'd change…";
    input.value = this.#chatInput;
    input.disabled = this.#chatSending;
    input.addEventListener("input", () => {
      this.#chatInput = input.value;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.#chatInput.trim()) {
        this.#sendMessage(this.#chatInput.trim());
      }
    });
    inputRow.appendChild(input);

    // Refine button
    const refineBtn = el<HTMLButtonElement>("button", "btn btn-accent");
    refineBtn.textContent = isWorking
      ? "Working…"
      : this.#feedbackQueue.length > 0
        ? `Refine (${this.#feedbackQueue.length})`
        : "Refine";
    refineBtn.disabled =
      isWorking || this.#feedbackQueue.length === 0 || !hasBaseline;
    refineBtn.addEventListener("click", () => this.#triggerRefine());
    inputRow.appendChild(refineBtn);

    this.#container.appendChild(inputRow);
  }

  /**
   * Send a message — adds to chat, queues as feedback, extracts preferences.
   * Awaits preference extraction so the reply arrives before refine starts.
   * Always uses Flash for refinement — Pro is opt-in via "Try with Pro".
   */
  async #sendMessage(text: string) {
    this.#chatMessages.push({ role: "user", text });
    this.#feedbackQueue.push(text);
    this.#chatInput = "";
    this.#render();

    // Extract preferences (awaited so reply appears before refine)
    await this.#extractPreferences(text);

    // Auto-refine if idle and we have a baseline
    if (
      this.#appFrame.hasBaseline &&
      !this.#panel.isRefining &&
      !this.#panel.isGenerating
    ) {
      this.#triggerRefine();
    }
  }

  /** Trigger a refinement with all queued feedback. */
  async #triggerRefine(model?: "gemini-3.1-pro-preview") {
    if (this.#feedbackQueue.length === 0 && !model) return;

    // For Pro retry, reuse last feedback; otherwise drain the queue
    const feedback =
      model && this.#lastFeedback
        ? this.#lastFeedback
        : this.#feedbackQueue.join("\n\n");
    const label =
      model && this.#lastLabel
        ? this.#lastLabel
        : this.#feedbackQueue.length === 1
          ? this.#feedbackQueue[0].slice(0, 40)
          : `${this.#feedbackQueue.length} items`;

    if (!model) {
      this.#lastFeedback = feedback;
      this.#lastLabel = label;
      this.#feedbackQueue = [];
    }

    this.#chatMessages.push({
      role: "system",
      text: model ? "Thinking harder…" : "Refining…",
    });
    this.#render();

    await this.#panel.triggerRefine(feedback, label, model);

    this.#chatMessages.push({
      role: "system",
      text: "Done — promote or keep iterating.",
    });

    // Offer Pro escalation (only after Flash refinements)
    if (!model) {
      this.#chatMessages.push({
        role: "system",
        text: "🧠 Try harder with Pro",
        action: () => this.#triggerRefine("gemini-3.1-pro-preview"),
      });
    }

    this.#render();
  }

  /** Drain the queue after a refinement completes. */
  async #drainQueue() {
    if (this.#feedbackQueue.length > 0) {
      this.#chatMessages.push({
        role: "system",
        text: `Applying ${this.#feedbackQueue.length} queued message${this.#feedbackQueue.length > 1 ? "s" : ""}…`,
      });
      this.#render();
      await this.#triggerRefine();
    }
  }

  /**
   * Extract preferences and complexity via chat API.
   * Returns the complexity classification for model routing.
   */
  async #extractPreferences(
    message: string
  ): Promise<"minor" | "major"> {
    try {
      const result = await chat({
        message,
        memory: this.#panel.memory,
        currentFiles: this.#appFrame.workingFiles,
        chatSkill: this.#panel.chatSkill,
      });

      if (result.memoryUpdate) {
        const update = result.memoryUpdate;
        const prefs = [...this.#panel.preferences];
        let memory = this.#panel.memory;

        if (update.startsWith("REPLACE:")) {
          // Reconcile contradictions: "REPLACE: old text → new text"
          const parts = update.slice(8).split("→").map((s) => s.trim());
          if (parts.length === 2) {
            const [oldText, newText] = parts;
            const filtered = prefs.filter((p) => p !== oldText);
            filtered.push(newText);
            memory = filtered.map((p) => `- ${p}`).join("\n");
            this.#panel.updatePreferences(filtered, memory);
          }
        } else {
          prefs.push(update);
          memory += (memory ? "\n" : "") + `- ${update}`;
          this.#panel.updatePreferences(prefs, memory);
        }
      }

      if (result.reply) {
        this.#chatMessages.push({ role: "assistant", text: result.reply });
        this.#render();
      }

      return result.complexity === "major" ? "major" : "minor";
    } catch {
      // Best-effort — default to minor on failure.
      return "minor";
    }
  }
}

function el<T extends HTMLElement>(tag: string, className?: string): T {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element as T;
}
