/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { createRef, ref } from "lit/directives/ref.js";

import "./expanding-textarea.js";
import "../effects/radial-glow.js";
import * as StringsHelper from "../../strings/helper.js";
import * as Styles from "../../styles/styles.js";
import { baseColors } from "../../styles/host/base-colors.js";
import type { SCA } from "../../../sca/sca.js";
import { scaContext } from "../../../sca/context/context.js";
import { ExpandingTextarea } from "./expanding-textarea.js";

const Strings = StringsHelper.forSection("Editor");
const DEFAULT_GLOW_PERIOD = 5_000;
const MAX_GLOW_PERIOD = 100_000;

@customElement("bb-opie-input")
export class OpieInput extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    baseColors,
    Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
      }

      #container {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
        gap: var(--bb-grid-size-3);
      }

      #input-pill {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex: 1;
        border: 1px solid light-dark(var(--n-90), var(--n-30));
        border-radius: 28px;
        background-color: light-dark(var(--n-100), var(--n-10));
        padding: 6px 16px;
        gap: var(--bb-grid-size);
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;

        &:focus-within {
          border-color: light-dark(var(--n-70), var(--n-50));
          box-shadow: 0 0 0 1px light-dark(var(--n-70), var(--n-50));
        }
      }

      bb-expanding-textarea {
        flex: 1;
        --min-lines: 1;
        --max-lines: 4;
        --padding: 0;
        --border-color: transparent;
        --background-color: transparent;
        color: light-dark(var(--n-10), var(--n-90));

        &[disabled] {
          opacity: 0.3;
        }
      }

      #submit-button {
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 50%;
        background-color: light-dark(var(--n-90), var(--n-20));
        color: light-dark(var(--n-40), var(--n-70));
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
          color 0.15s ease,
          transform 0.1s ease;
        flex-shrink: 0;

        &:hover {
          color: light-dark(var(--n-10), var(--n-95));
        }

        &[disabled] {
          opacity: 0.5;
          cursor: default;
          pointer-events: none;
        }

        & .g-icon {
          font-size: 24px;
        }
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }

      radial-glow {
        flex: 1;
        display: flex;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true })
  accessor focused = false;

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property({ reflect: true, type: Boolean })
  accessor editable = false;

  @state()
  accessor hasContent = false;

  private descriptionInput = createRef<ExpandingTextarea>();

  private get isCreating() {
    return this.sca.controller.global.main.blockingAction;
  }

  private get isFresh() {
    const state = this.sca.controller.editor.graph.graphContentState;
    return state === "loading" || state === "empty";
  }

  private get currentExampleIntent() {
    return this.sca.controller.global.flowgenInput.currentExampleIntent;
  }

  override render() {
    const iconClasses = {
      "g-icon": true,
      filled: true,
      heavy: true,
      round: true,
      rotate: this.isCreating,
    };

    const glowPeriod =
      this.focused || this.hasContent ? MAX_GLOW_PERIOD : DEFAULT_GLOW_PERIOD;

    return html`
      <div id="container">
        <radial-glow
          mode="periodic"
          .period=${glowPeriod}
          glow-size="18"
          style=${styleMap({
            "--start-angle": "0deg",
            "--glow-duration": "3s",
            "--mask-sweep": "360deg",
            "--color-sweep": "360deg",
            "--glow-colors": `var(--t-100) 0%,
              var(--p-70) 30%,
              var(--t-70) 40%,
              var(--t-90) 50%,
              var(--t-100) 55%`,
          })}
        >
          <div id="input-pill">
            <bb-expanding-textarea
              ${ref(this.descriptionInput)}
              .disabled=${this.isCreating || !this.editable}
              .classes=${"sans-flex w-400 md-body-large"}
              .orientation=${"vertical"}
              .placeholder=${this.isFresh
                ? Strings.from("COMMAND_DESCRIBE_FRESH_FLOW_ALT")
                : Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
              .showSubmitButton=${false}
              @input=${this.onInput}
              @change=${this.submit}
              @focus=${this.onInputFocus}
              @blur=${this.onInputBlur}
            ></bb-expanding-textarea>
          </div>
        </radial-glow>
        <button
          id="submit-button"
          ?disabled=${this.isCreating || !this.editable}
          @click=${this.submit}
        >
          <span class=${classMap(iconClasses)}
            >${this.isCreating ? "progress_activity" : "send"}</span
          >
        </button>
      </div>
    `;
  }

  async submit() {
    await this.onInputChange();
  }

  override updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    // Seed the textarea when a suggestion chip is clicked, then clear the
    // signal so it doesn't overwrite user edits on subsequent renders.
    const intent = this.currentExampleIntent;
    if (intent && this.descriptionInput.value) {
      this.descriptionInput.value.value = intent;
      this.hasContent = true;
      this.sca.controller.global.flowgenInput.currentExampleIntent = "";
    }
  }

  private onInput() {
    const input = this.descriptionInput.value;
    if (!input) {
      return;
    }

    const description = input.value;
    this.hasContent = description !== "";
  }

  private async onInputChange() {
    const input = this.descriptionInput.value;
    if (!input) {
      return;
    }

    const description = input.value;
    this.hasContent = description !== "";
    if (!description) return;

    const result = await this.sca.actions.opie.createNew(description);
    if (result.success) {
      this.clearInput();
    } else {
      console.error("Failed to create board with Opie", result.reason);
    }
  }

  private clearInput() {
    if (this.descriptionInput.value) {
      this.descriptionInput.value.value = "";
    }
  }

  private onInputFocus() {
    this.focused = true;
  }

  private onInputBlur() {
    this.focused = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-opie-input": OpieInput;
  }
}
