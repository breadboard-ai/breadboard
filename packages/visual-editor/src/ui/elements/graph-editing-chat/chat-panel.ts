/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import type { ChatEntry } from "../../../sca/types.js";
import { markdown } from "../../directives/markdown.js";
import { icons } from "../../styles/icons.js";
import * as Styles from "../../styles/styles.js";
import "../input/expanding-textarea.js";
import type { ExpandingTextarea } from "../input/expanding-textarea.js";
import "./opie-avatar.js";
import "../effects/radial-glow.js";
import { styleMap } from "lit/directives/style-map.js";
import type {
  AddAssetRequestEvent,
  AddAssetEvent,
} from "../../events/events.js";
import "../input/add-asset/add-asset-button.js";
import "../input/add-asset/add-asset-modal.js";
import "./input-asset-shelf.js";

export { ChatPanel };

/**
 * The speech-bubble chat panel. Contains the scrollable message history,
 * the input field, and the send button. Designed to sit above Opie and
 * connect via a CSS tail.
 *
 * All state lives in GraphEditingAgentController; all orchestration in
 * the corresponding service. This component only renders and dispatches.
 */
@customElement("bb-chat-panel")
class ChatPanel extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  readonly #inputRef = createRef<ExpandingTextarea>();

  #showAddAssetModal = false;
  #addAssetType: string | null = null;
  #allowedMimeTypes: string | null = null;

  static styles = [
    icons,
    Styles.HostType.type,
    css`
      :host {
        display: block;
        position: relative;
      }

      /* ── Bubble shell ── */

      .bubble {
        position: relative;
        background: var(--light-dark-n-100);
        border-radius: var(--bb-grid-size-4);
        display: flex;
        flex-direction: column;
        width: 80svw;
        max-width: 430px;
        max-height: 480px;
      }

      /* ── Messages ── */

      .messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--bb-grid-size-4);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-3);
        margin-right: 4px;
        margin-top: 8px;
        scrollbar-width: thin;
        scrollbar-color: var(--light-dark-n-60) transparent;
        mask-image: linear-gradient(transparent 0%, black 12px, black 100%);

        &::-webkit-scrollbar {
          width: 6px;
        }

        &::-webkit-scrollbar-track {
          background: transparent;
        }

        &::-webkit-scrollbar-thumb {
          background: var(--light-dark-n-60);
          border-radius: 9999px;
        }
      }

      .msg-row {
        display: flex;
        align-items: flex-start;
        gap: var(--bb-grid-size-2);
      }

      .msg-row.user {
        flex-direction: row-reverse;

        & .avatar {
          margin-top: var(--bb-grid-size);
        }
      }

      .msg-row .avatar {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .msg-row .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .msg-row .avatar .fallback {
        width: 100%;
        height: 100%;
        background: var(--light-dark-p-90);
        color: var(--light-dark-p-40);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .msg-bubble {
        font-size: 14px;
        line-height: 1.5;
        padding-top: 4px;
        max-width: 80%;
      }

      .msg-bubble.user {
        background: var(--light-dark-p-90);
        color: var(--light-dark-n-10);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: 18px;
      }

      .msg-bubble.model {
        color: var(--light-dark-n-10);
      }

      .msg-bubble.model p {
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      .msg-bubble.model p:last-child {
        margin-bottom: 0;
      }

      .msg-bubble.model ul,
      .msg-bubble.model ol {
        margin: 0 0 var(--bb-grid-size-2) 0;
        padding-left: 20px;
      }

      .msg-bubble.model code {
        background: var(--light-dark-n-95);
        padding: 1px var(--bb-grid-size);
        border-radius: var(--bb-grid-size);
        font-size: 13px;
      }

      .msg-bubble.model pre {
        background: var(--light-dark-n-95);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-2);
        overflow-x: auto;
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      .msg-bubble.model pre code {
        background: none;
        padding: 0;
      }

      .msg-bubble.system {
        color: var(--light-dark-n-50);
        font-size: 13px;
      }

      /* ── Thought groups ── */

      .thought-group {
        align-self: flex-start;
      }

      .thought-group-header {
        display: flex;
        align-items: center;
        cursor: pointer;
        color: var(--light-dark-n-50);
        font-size: 13px;
        user-select: none;
        list-style: none;
      }

      .thought-group-header::-webkit-details-marker {
        display: none;
      }

      .thought-group-header .chevron {
        margin-right: var(--bb-grid-size);
        opacity: 0.6;
      }

      .thought-group-header .chevron::before {
        content: "keyboard_arrow_up";
      }

      .thought-group[open] > .thought-group-header .chevron::before {
        content: "keyboard_arrow_down";
      }

      .thought-group-header:hover {
        color: var(--light-dark-n-10);
      }

      .thought-group-body {
        padding: var(--bb-grid-size) 0 var(--bb-grid-size) var(--bb-grid-size-6);
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size);
      }

      .thought-item {
        font-size: 12px;
        color: var(--light-dark-n-50);
        line-height: 1.4;
      }

      .thought-item-title {
        font-weight: 500;
        color: var(--light-dark-n-30);
      }

      /* ── Input area ── */

      .input-area {
        display: flex;
        flex-direction: column;
        gap: 0;
        border-top: 1px solid var(--light-dark-n-95);
      }

      .input-row {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-3);
      }
      bb-expanding-textarea {
        flex: 1;
        background: var(--light-dark-n-98);
        border: 1px solid var(--light-dark-n-90);
        border-radius: var(--bb-grid-size-7);
        padding: var(--bb-grid-size) var(--bb-grid-size-3);
        --min-lines: 1;
        --max-lines: 4;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        line-height: 1lh;
        caret-color: var(--light-dark-n-0);

        &:focus-within {
          border-color: var(--light-dark-n-70);
        }

        &::part(textarea)::placeholder {
          color: var(--light-dark-n-50);
        }
      }

      .send-button {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: var(--light-dark-n-10);
        color: var(--light-dark-n-100);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition:
          background 0.15s ease,
          opacity 0.15s ease;
        opacity: 0.4;
        pointer-events: none;
      }

      .send-button.active {
        opacity: 1;
        pointer-events: auto;
      }

      .send-button.active:hover {
        background: var(--light-dark-n-0);
      }

      /* ── Selection indicator ── */

      .selection-strip {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        flex-wrap: wrap;
        font-size: 12px;
        border-top: 1px solid var(--light-dark-n-90);
      }

      .selection-strip .selection-label {
        color: var(--light-dark-n-50);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .selection-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--bb-grid-size);
        background: var(--light-dark-p-90);
        color: var(--light-dark-n-10);
        border-radius: var(--bb-grid-size-3);
        padding: 2px var(--bb-grid-size) 2px var(--bb-grid-size-2);
        font-size: 12px;
        font-weight: 500;
      }

      .selection-chip button {
        background: none;
        border: none;
        color: var(--light-dark-n-50);
        cursor: pointer;
        font-size: 14px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        width: 16px;
        height: 16px;
      }

      .selection-chip button:hover {
        color: var(--light-dark-n-10);
        background: var(--light-dark-n-90);
      }

      .feedback-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        margin-top: calc(-1 * var(--bb-grid-size-3) + 2px);
        box-sizing: border-box;
        padding-right: var(--bb-grid-size-2);
      }

      .feedback-button {
        background: none;
        border: none;
        color: var(--light-dark-n-60);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        padding: 0;
        transition:
          background 0.15s ease,
          color 0.15s ease;
      }

      .feedback-button .g-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
        overflow: visible;
      }

      .feedback-button:hover {
        color: var(--light-dark-n-10);
        background: var(--light-dark-n-95);
      }

      .feedback-button.active .g-icon {
        font-variation-settings: "FILL" 1;
        color: var(--light-dark-p-40);
      }
    `,
  ];

  override updated() {
    this.#scrollToBottom();
  }

  get inputRef() {
    return this.#inputRef;
  }

  render() {
    const agent = this.sca.controller.editor.graphEditingAgent;
    const inputAssets = this.sca.controller.editor.inputAssets;
    const inputDisabled = agent.processing;
    const hasInput = !!this.#inputRef.value?.value;

    return html`
      <div class="bubble">
        <div class="messages">
          ${agent.entries.map((entry) =>
            entry.kind === "thought-group" && !agent.loopRunning
              ? nothing
              : this.#renderEntry(entry)
          )}
          ${(() => {
            const lastEntry = agent.entries[agent.entries.length - 1];
            const hasUser = agent.entries.some(
              (e) => e.kind === "message" && e.role === "user"
            );
            const showFeedback =
              lastEntry &&
              lastEntry.kind === "message" &&
              lastEntry.role === "model" &&
              hasUser;
            return showFeedback
              ? html`
                  <div class="feedback-row">
                    <button
                      class="feedback-button ${agent.feedbackReaction === "up"
                        ? "active"
                        : ""}"
                      @click=${() =>
                        this.sca.actions.graphEditingAgent.setOpieReaction(
                          "up"
                        )}
                      title="Thumbs Up"
                    >
                      <span class="g-icon">thumb_up</span>
                    </button>
                    <button
                      class="feedback-button ${agent.feedbackReaction === "down"
                        ? "active"
                        : ""}"
                      @click=${() =>
                        this.sca.actions.graphEditingAgent.setOpieReaction(
                          "down"
                        )}
                      title="Thumbs Down"
                    >
                      <span class="g-icon">thumb_down</span>
                    </button>
                  </div>
                `
              : nothing;
          })()}
          ${agent.loopRunning && !agent.waiting
            ? html`<div class="msg-row">
                <div class="avatar">
                  <radial-glow
                    continuous
                    glow-size="16"
                    border-radius="50%"
                    style=${styleMap({
                      "--start-angle": "140deg",
                      "--glow-duration": "1.3s",
                      "--mask-sweep": "360deg",
                      "--color-sweep": "360deg",
                      "--glow-colors": `var(--n-100) 0%,
                        var(--t-70) 30%,
                        var(--p-70) 50%,
                        var(--t-70) 70%,
                        var(--n-100) 100%`,
                    })}
                  >
                    <bb-opie-avatar small static></bb-opie-avatar>
                  </radial-glow>
                </div>
                <div class="msg-bubble system">Thinking…</div>
              </div>`
            : nothing}
        </div>

        ${this.#renderSelectionStrip()}

        <div class="input-area">
          ${this.#renderAssetShelf()}
          <div class="input-row">
            <bb-add-asset-button
              .anchor=${"above"}
              .showGDrive=${true}
              .showNotebookLm=${!!this.sca.env.flags.get("enableNotebookLm")}
              @bbaddassetrequest=${(evt: AddAssetRequestEvent) => {
                if (evt.assetType === "notebooklm") {
                  this.sca.actions.notebookLmPicker.open((notebooks) => {
                    this.sca.actions.inputAsset.addFromNotebookLm(notebooks);
                  });
                  return;
                }
                this.#showAddAssetModal = true;
                this.#addAssetType = evt.assetType;
                this.#allowedMimeTypes = evt.allowedMimeTypes;
                this.requestUpdate();
              }}
            ></bb-add-asset-button>
            <bb-expanding-textarea
              ${ref(this.#inputRef)}
              .disabled=${inputDisabled}
              .placeholder=${"Ask a question or make a change..."}
              @change=${this.#onSend}
              @input=${() => this.requestUpdate()}
              ><span slot="submit" style="display:none"></span
            ></bb-expanding-textarea>
            <button
              class="send-button ${hasInput || inputAssets.populated
                ? "active"
                : ""}"
              @click=${() => this.#onSend()}
            >
              <span class="g-icon">send</span>
            </button>
          </div>
        </div>
      </div>
      ${this.#renderAddAssetModal()}
    `;
  }

  #renderEntry(entry: ChatEntry) {
    if (entry.kind === "message") {
      if (entry.role === "user") {
        return this.#renderUserMessage(entry.text);
      }
      if (entry.role === "model") {
        return this.#renderModelMessage(entry.text);
      }
      // system message
      return html`<div class="msg-bubble system">${entry.text}</div>`;
    }

    // Thought group
    const thoughts = entry.thoughts;
    const latest = thoughts[thoughts.length - 1];
    const title = latest.title ?? latest.body;

    return html`
      <details class="thought-group">
        <summary class="thought-group-header">
          <span class="chevron g-icon"></span>${title}
        </summary>
        <div class="thought-group-body">
          ${thoughts.map(
            (t) => html`
              <div class="thought-item">
                ${t.title
                  ? html`<span class="thought-item-title">${t.title}:</span>
                      ${markdown(t.body)}`
                  : markdown(t.body)}
              </div>
            `
          )}
        </div>
      </details>
    `;
  }

  #renderUserMessage(text: string) {
    const picture = this.sca.services.signinAdapter.pictureSignal;
    const name = this.sca.services.signinAdapter.nameSignal;

    return html`
      <div class="msg-row user">
        <div class="avatar">
          ${picture
            ? html`<img crossorigin .src=${picture} alt=${name ?? "You"} />`
            : html`<span class="fallback g-icon filled">person</span>`}
        </div>
        <div class="msg-bubble user">${text}</div>
      </div>
    `;
  }

  #renderModelMessage(text: string) {
    return html`
      <div class="msg-row">
        <div class="avatar">
          <bb-opie-avatar small static></bb-opie-avatar>
        </div>
        <div class="msg-bubble model">${markdown(text)}</div>
      </div>
    `;
  }

  #renderSelectionStrip() {
    const selection = this.sca.controller.editor.selection;
    const selectedNodes = selection.selection.nodes;
    if (selectedNodes.size === 0) return nothing;

    const editor = this.sca.controller.editor.graph.editor;
    if (!editor) return nothing;

    const inspector = this.sca.controller.editor.graph.inspect("");
    const chips = [...selectedNodes].map((nodeId) => {
      const node = inspector.nodeById(nodeId);
      const title = node?.metadata()?.title ?? "(untitled)";
      return html`
        <span class="selection-chip">
          ${title}
          <button
            @click=${() => {
              selection.removeNode(nodeId);
              this.#inputRef.value?.focus();
            }}
            title="Deselect ${title}"
          >
            <span class="g-icon">close</span>
          </button>
        </span>
      `;
    });

    return html`
      <div class="selection-strip">
        <span class="selection-label">Selected</span>
        ${chips}
      </div>
    `;
  }

  async #onSend() {
    const input = this.#inputRef.value;
    if (!input) return;

    const text = input.value.trim();
    const inputAssets = this.sca.controller.editor.inputAssets;
    const hasAssets = inputAssets.populated;

    if (!text && !hasAssets) return;

    // Drain assets before clearing text so the message includes them.
    const assets = inputAssets.drain();

    input.value = "";
    const agent = this.sca.controller.editor.graphEditingAgent;

    // Build the display text. If there are assets, note them.
    const assetSuffix =
      assets.length > 0
        ? ` [${assets.length} attachment${assets.length > 1 ? "s" : ""}]`
        : "";
    const displayText = text || "(attachments)";
    agent.addMessage("user", displayText + assetSuffix);
    this.#scrollToBottom();

    if (
      !this.sca.actions.graphEditingAgent.resolveGraphEditingInput(
        text || "(see attachments)",
        assets
      )
    ) {
      agent.processing = true;
      this.sca.actions.graphEditingAgent.startGraphEditingAgent(
        text || "(see attachments)",
        assets
      );
    }
  }

  #scrollToBottom() {
    requestAnimationFrame(() => {
      const container = this.renderRoot.querySelector(".messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  focus() {
    this.#inputRef.value?.focus();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSET SHELF RENDERING
  // ═══════════════════════════════════════════════════════════════════════════

  #renderAssetShelf() {
    return html`<bb-input-asset-shelf></bb-input-asset-shelf>`;
  }

  #renderAddAssetModal() {
    if (!this.#showAddAssetModal) return nothing;

    return html`<bb-add-asset-modal
      .assetType=${this.#addAssetType}
      .allowedMimeTypes=${this.#allowedMimeTypes}
      @bboverlaydismissed=${() => {
        this.#showAddAssetModal = false;
        this.#addAssetType = null;
        this.#allowedMimeTypes = null;
        this.requestUpdate();
      }}
      @bbaddasset=${(evt: AddAssetEvent) => {
        this.#showAddAssetModal = false;
        this.#addAssetType = null;
        this.#allowedMimeTypes = null;
        this.sca.actions.inputAsset.addFromModal(evt.asset);
        this.requestUpdate();
      }}
    ></bb-add-asset-modal>`;
  }
}
