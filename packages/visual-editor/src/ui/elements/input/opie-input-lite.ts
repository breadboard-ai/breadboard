/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref } from "lit/directives/ref.js";

import "./expanding-textarea.js";
import "../graph-editing-chat/opie-avatar.js";
import * as StringsHelper from "../../strings/helper.js";
import * as Styles from "../../styles/styles.js";
import type { SCA } from "../../../sca/sca.js";
import { scaContext } from "../../../sca/context/context.js";
import { ExpandingTextarea } from "./expanding-textarea.js";

const Strings = StringsHelper.forSection("Editor");

@customElement("bb-opie-input-lite")
export class OpieInputLite extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColorsMaterial.baseColors,
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
        border: 1px solid var(--sys-color--outline-variant);
        border-radius: 100px;
        background-color: var(--sys-color--body-background);
        padding: 6px 16px 6px 6px;
        gap: var(--bb-grid-size);
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;

        &:focus-within {
          border-color: var(--light-dark-n-70);
          box-shadow: 0 0 0 1px var(--light-dark-n-70);
        }
      }

      bb-opie-avatar {
        flex-shrink: 0;
      }

      bb-expanding-textarea {
        flex: 1;
        --min-lines: 1;
        --max-lines: 4;
        --padding: 0;
        --border-color: transparent;
        --background-color: transparent;
        color: var(--sys-color--on-surface);

        &[disabled] {
          opacity: 0.3;
        }
      }

      #submit-button {
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 50%;
        background-color: var(--light-dark-n-90);
        color: var(--light-dark-n-40);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition:
          color 0.15s ease,
          transform 0.1s ease;
        flex-shrink: 0;

        &:hover {
          color: var(--light-dark-n-10);
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
    `,
  ];

  @property({ type: Boolean, reflect: true })
  accessor focused = false;

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property({ reflect: true, type: Boolean })
  accessor editable = false;

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

    return html`
      <div id="container">
        <div id="input-pill">
          <bb-opie-avatar
            mode="large"
            .supportsHover=${false}
            ?static=${this.isCreating}
          ></bb-opie-avatar>
          <bb-expanding-textarea
            ${ref(this.descriptionInput)}
            .disabled=${this.isCreating || !this.editable}
            .classes=${"sans-flex w-400 md-body-large"}
            .orientation=${"vertical"}
            .value=${this.currentExampleIntent}
            .placeholder=${this.isFresh
              ? Strings.from("COMMAND_DESCRIBE_FRESH_FLOW_ALT")
              : Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
            .showSubmitButton=${false}
            @change=${this.submit}
            @focus=${this.onInputFocus}
            @blur=${this.onInputBlur}
          ></bb-expanding-textarea>
        </div>
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

  private async onInputChange() {
    const input = this.descriptionInput.value;
    if (!input) {
      return;
    }

    const description = input.value;
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
    "bb-opie-input-lite": OpieInputLite;
  }
}
