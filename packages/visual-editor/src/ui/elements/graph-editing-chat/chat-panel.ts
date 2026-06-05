/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import type { ChatEntry } from "../../../sca/types.js";
import { markdown } from "../../directives/markdown.js";
import * as StringsHelper from "../../strings/helper.js";

const GlobalStrings = StringsHelper.forSection("Global");
import { icons } from "../../styles/icons.js";
import * as Styles from "../../styles/styles.js";
import "../input/expanding-textarea.js";
import type { ExpandingTextarea } from "../input/expanding-textarea.js";
import "../shared/agent-avatar.js";
import "../effects/radial-glow.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { getStepIcon } from "../../utils/get-step-icon.js";
import type { InspectableNode } from "@breadboard-ai/types";
import {
  AddAssetRequestEvent,
  AddAssetEvent,
  UtteranceEvent,
} from "../../events/events.js";
import "../input/add-asset/add-asset-button.js";
import "../input/add-asset/add-asset-modal.js";
import "../input/speech-to-text/speech-to-text.js";
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

  @property({ type: String, reflect: true })
  accessor mode: "floating" | "embedded" = "floating";

  @property({ type: Boolean })
  accessor showSelectionStrip = true;

  readonly #inputRef = createRef<ExpandingTextarea>();

  #showAddAssetModal = false;
  #addAssetType: string | null = null;
  #allowedMimeTypes: string | null = null;

  @state()
  accessor speechToTextActive = false;

  static styles = [
    icons,
    Styles.HostType.type,
    Styles.HostColorsBase.baseColors,
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

      :host([mode="embedded"]) {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
      }

      :host([mode="embedded"]) .bubble {
        width: 100%;
        max-width: 100%;
        max-height: 100%;
        height: 100%;
        border-radius: 0;
        background: transparent;
        border-top: none;
        box-shadow: none;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      :host([mode="embedded"]) .messages {
        mask-image: none;
        -webkit-mask-image: none;
        min-height: 0;
        flex: 1;
        padding-bottom: var(
          --bb-grid-size-5
        ); /* bb-grid-size-5 at the bottom */
      }

      /* Spacer pushes content to the bottom when the conversation
         is short. Compresses to zero when it overflows, allowing
         normal scrolling. */
      :host([mode="embedded"]) .messages::before {
        content: "";
        flex: 1;
      }

      :host([mode="embedded"]) .input-area {
        background: var(--light-dark-n-100);
        border-top: 1px solid var(--light-dark-n-95);
        flex-shrink: 0;
      }

      :host([mode="embedded"]) bb-expanding-textarea {
        background: var(--light-dark-n-100);
        scrollbar-width: none;
      }

      /* ── Messages ── */

      .messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--chat-messages-padding-top, var(--bb-grid-size-4))
          var(--bb-grid-size-6) var(--bb-grid-size-4) var(--bb-grid-size-6); /* bb-grid-size-6 on the sides */
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-5); /* Increased spacing between message rows */
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
        font-family: var(--bb-font-family-flex, "Google Sans Flex", sans-serif);
        font-size: 14px;
        line-height: 20px;
        font-weight: 400;
        font-feature-settings: "ss02" on;
        color: light-dark(rgba(0, 0, 0, 0.8), rgba(255, 255, 255, 0.9));
        padding-top: 4px;
        max-width: 80%;
      }

      .msg-bubble.user {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        align-self: stretch;

        border-radius: 20px;
        border: none;
        background: var(--n-95, #f1f3f4);
        box-shadow: none;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        color: light-dark(var(--n-30), var(--n-50));
      }

      .msg-bubble.model {
        /* inherits everything from .msg-bubble */
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
        transition: transform 0.15s ease;
      }

      .thought-group[open] > .thought-group-header .chevron {
        transform: rotate(90deg);
      }

      .thought-group-header:hover {
        color: var(--light-dark-n-10);
      }

      .thought-group-body {
        padding: var(--bb-grid-size) 0 var(--bb-grid-size) var(--bb-grid-size-4);
        margin-left: 8px;
        border-left: 1px solid var(--light-dark-n-90);
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
        border-top: 1px solid light-dark(var(--n-90), var(--n-70));
      }

      .input-row {
        display: flex;
        align-items: flex-end;
        gap: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-4) var(--bb-grid-size-4);
      }
      bb-expanding-textarea {
        flex: 1;
        background: var(--light-dark-n-98);
        border: 1px solid var(--light-dark-n-90);
        border-radius: 16px; /* Softer border-radius */
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4); /* More padding */
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

      .mic-button {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--light-dark-n-40);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .mic-button:hover {
        background: var(--light-dark-n-95);
        color: var(--light-dark-n-10);
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

      /* ── Unified Input Card (Mock-aligned) ── */

      .unified-input-card {
        display: flex;
        flex-direction: column;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-90);
        border-radius: 24px;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        margin: 0 var(--bb-grid-size-6) var(--bb-grid-size-2)
          var(--bb-grid-size-6); /* Matches side padding (24px) and bottom padding (8px) */
        box-shadow: 0 8px 40px 0 rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
      }

      #disclaimer {
        font: 400 11px / 1.4 var(--bb-font-family);
        color: var(--light-dark-n-50);
        text-align: center;
        margin-bottom: var(--bb-grid-size-4);
        margin-top: 0;
        user-select: none;
        pointer-events: none;
      }

      bb-expanding-textarea {
        --border-color: transparent;
        --background-color: transparent;
        --padding: 0;
        --border-radius: 0;
        width: 100%;
      }

      bb-expanding-textarea::part(textarea) {
        color: light-dark(rgba(0, 0, 0, 0.8), rgba(255, 255, 255, 0.9));
      }

      bb-expanding-textarea::part(textarea)::placeholder {
        color: light-dark(#8f8f8f, var(--n-50));
      }

      .unified-input-card bb-expanding-textarea {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        width: 100%;
        --min-lines: 1;
        --max-lines: 6;

        &:focus-within {
          border: none !important;
          outline: none !important;
        }

        &::part(textarea) {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          outline: none !important;
        }
      }

      .unified-input-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-top: var(--bb-grid-size-3);
        padding-top: var(--bb-grid-size-2);
        border-top: 1px dashed var(--light-dark-n-95);
      }

      .mic-card-button,
      .send-card-button {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--light-dark-n-40);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .mic-card-button:hover {
        background: var(--light-dark-n-95);
        color: var(--light-dark-n-10);
      }

      .send-card-button.active {
        color: var(--light-dark-p-40);
      }

      .send-card-button.active:hover {
        background: var(--light-dark-n-95);
        color: var(--light-dark-n-10);
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
        color: light-dark(var(--n-0), var(--n-10));
        border-radius: var(--bb-grid-size-3);
        padding: 2px var(--bb-grid-size) 2px var(--bb-grid-size-2);
        font-size: 12px;
        font-weight: 500;
      }

      .selection-chip.generate {
        background: var(--ui-generate);
      }

      .selection-chip.get-input {
        background: var(--ui-get-input);
      }

      .selection-chip.display {
        background: var(--ui-display);
      }

      .selection-chip.default {
        background: var(--light-dark-n-70);
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

    const agent = this.sca.controller.editor.graphEditingAgent;
    if (agent.autoFocus) {
      agent.autoFocus = false;
      this.focus();
    }
  }

  get inputRef() {
    return this.#inputRef;
  }

  render() {
    const agent = this.sca.controller.editor.graphEditingAgent;
    void agent.autoFocus;

    return html`
      <div class="bubble">
        <div class="messages">
          ${agent.entries.map((entry, index) => {
            const isLast = index === agent.entries.length - 1;
            return this.#renderEntry(entry, isLast);
          })}
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
                    <bb-agent-avatar mode="small" static></bb-agent-avatar>
                  </radial-glow>
                </div>
                <div class="msg-bubble system">Thinking…</div>
              </div>`
            : nothing}
        </div>

        ${this.showSelectionStrip ? this.#renderSelectionStrip() : nothing}
        ${this.#renderInputArea()}
        <div id="disclaimer">${GlobalStrings.from("LABEL_DISCLAIMER")}</div>
      </div>
      ${this.#renderAddAssetModal()}
    `;
  }

  #renderInputArea() {
    const readOnly = this.sca.controller.editor.graph.readOnly;
    const agent = this.sca.controller.editor.graphEditingAgent;
    const inputAssets = this.sca.controller.editor.inputAssets;
    const inputDisabled = agent.processing;
    const hasInput = !!this.#inputRef.value?.value;

    if (this.mode === "embedded") {
      return html`
        <div class="unified-input-card">
          <bb-expanding-textarea
            ${ref(this.#inputRef)}
            .disabled=${inputDisabled}
            .classes=${"sans-flex w-400 md-body-medium"}
            .placeholder=${readOnly
              ? "Ask a question"
              : "Ask a question or request a change..."}
            @change=${this.#onSend}
            @input=${() => this.requestUpdate()}
            ><span slot="submit" style="display:none"></span
          ></bb-expanding-textarea>
          ${this.#renderAssetShelf()}

          <div class="unified-input-footer">
            <bb-add-asset-button
              .anchor=${"above"}
              .showGDrive=${true}
              .showNotebookLm=${!!this.sca.env.flags.get("enableNotebookLm")}
              .label=${"Attach"}
              .variant=${"seamless"}
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

            ${(hasInput || inputAssets.populated) && !this.speechToTextActive
              ? html`<button
                  class="send-card-button active"
                  @click=${() => this.#onSend()}
                  title="Send message"
                >
                  <span class="g-icon">send</span>
                </button>`
              : html`<bb-speech-to-text
                  .variant=${"seamless"}
                  .disabled=${inputDisabled}
                  @start=${() => {
                    this.speechToTextActive = true;
                  }}
                  @end=${() => {
                    this.speechToTextActive = false;
                  }}
                  @bbutterance=${(evt: UtteranceEvent) => {
                    const textarea = this.#inputRef.value;
                    if (!textarea) return;
                    textarea.value = evt.parts
                      .map((part) => part.transcript)
                      .join("");
                    this.requestUpdate();
                  }}
                ></bb-speech-to-text>`}
          </div>
        </div>
      `;
    }

    return html`
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
            .placeholder=${readOnly
              ? "Ask a question"
              : "Ask a question or request a change..."}
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
    `;
  }

  #renderEntry(entry: ChatEntry, isLast: boolean) {
    const agent = this.sca.controller.editor.graphEditingAgent;

    if (entry.kind === "message") {
      if (entry.role === "user") {
        return this.#renderUserMessage(entry.text);
      }
      if (entry.role === "model") {
        return this.#renderModelMessage(entry.text);
      }
      // system message
      if (!agent.loopRunning || !isLast) {
        return nothing;
      }
      return html`<div class="msg-bubble system">${entry.text}</div>`;
    }

    // Thought group
    const thoughts = entry.thoughts;
    const latest = thoughts[thoughts.length - 1];
    const title = latest.title ?? latest.body;

    const body = html`
      <summary class="thought-group-header">
        <span class="chevron g-icon">keyboard_arrow_right</span>${title}
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
    `;

    // Wrap thought groups in Opie avatar row to match premium mock
    return html`
      <div class="msg-row">
        <div class="avatar">
          <bb-agent-avatar mode="small" static></bb-agent-avatar>
        </div>
        <div class="msg-bubble model">
          <details class="thought-group">${body}</details>
        </div>
      </div>
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
          <bb-agent-avatar mode="small" static></bb-agent-avatar>
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
      const colorClass = node ? getNodeColorClass(node) : "default";
      return html`
        <span
          class=${classMap({
            "selection-chip": true,
            [colorClass]: true,
          })}
        >
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

    for (const asset of assets) {
      await this.sca.actions.asset.addGraphAsset(asset);
    }

    if (text) {
      const resolved =
        await this.sca.actions.graphEditingAgent.resolveGraphEditingInput(text);
      if (!resolved) {
        agent.processing = true;
        await this.sca.actions.graphEditingAgent.startGraphEditingAgent(text);
      }
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
        this.sca.actions.inputAsset.addFromModal(evt.asset, evt.metadata);
        this.requestUpdate();
      }}
    ></bb-add-asset-modal>`;
  }
}

function getNodeColorClass(node: InspectableNode): string {
  const ports = node.currentPorts();
  const metadata = node.type().currentMetadata();
  const icon = getStepIcon(metadata.icon, ports) || null;
  const legacyNodeType = node.type().type();

  const classes = new Set<string>();
  if (metadata.tags) {
    for (const tag of metadata.tags) {
      classes.add(tag);
    }
  }

  let nodeIcon = icon;
  if (!URL.canParse(legacyNodeType)) {
    if (!nodeIcon) {
      nodeIcon = legacyNodeType;
    }
    if (legacyNodeType.startsWith("#module")) {
      classes.add("module");
    } else {
      classes.add(legacyNodeType);
    }
  }

  if (
    classes.has("generative") ||
    classes.has("module") ||
    [
      "spark",
      "photo_spark",
      "audio_magic_eraser",
      "text_analysis",
      "button_magic",
      "generative-image-edit",
      "generative-code",
      "videocam_auto",
      "generative-search",
      "generative",
      "select_all",
      "laps",
    ].includes(nodeIcon || "")
  ) {
    return "generate";
  }

  if (
    [
      "output",
      "docs",
      "drive_presentation",
      "sheets",
      "code",
      "web",
      "responsive_layout",
    ].includes(nodeIcon || "")
  ) {
    return "display";
  }

  if (
    classes.has("input") ||
    classes.has("output") ||
    classes.has("core") ||
    ["input", "ask-user", "chat_mirror"].includes(nodeIcon || "")
  ) {
    return "get-input";
  }

  return "default";
}
