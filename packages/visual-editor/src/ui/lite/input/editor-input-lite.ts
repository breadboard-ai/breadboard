/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref } from "lit/directives/ref.js";
import { actionTrackerContext } from "../../contexts/action-tracker-context.js";
import "../../elements/input/expanding-textarea.js";
import { SnackbarEvent, UnsnackbarEvent } from "../../events/events.js";
import { OneShotFlowGenFailureResponse } from "../../flow-gen/flow-generator.js";
import { LiteModeState } from "../../state/types.js";
import * as StringsHelper from "../../strings/helper.js";
import * as Styles from "../../styles/styles.js";
import { ActionTracker, SnackType } from "../../types/types.js";

const Strings = StringsHelper.forSection("Editor");

export type LiteEditInputController = {
  generate(intent: string): Promise<OneShotFlowGenFailureResponse | undefined>;
};

@customElement("bb-editor-input-lite")
export class EditorInputLite extends SignalWatcher(LitElement) {
  @consume({ context: actionTrackerContext })
  accessor actionTracker!: ActionTracker;

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
        border-radius: var(--bb-grid-size-6);
      }

      #container {
        display: flex;
        flex-direction: column;
        position: relative;

        & bb-expanding-textarea {
          --min-lines: 1;
          --max-lines: 4;
          --padding: var(--bb-grid-size-3);
          --border-color: var(--sys-color--outline-variant);
          --border-radius: var(--bb-grid-size-6);
          --background-color: var(--sys-color--body-background);
          color: var(--sys-color--on-surface);

          &:focus-within {
            outline: 1px solid var(--light-dark-n-70);
          }

          &[disabled] {
            opacity: 0.3;
          }
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

  @property()
  accessor controller: LiteEditInputController | undefined = undefined;

  @property()
  accessor state!: LiteModeState;

  @property({ reflect: true, type: Boolean })
  accessor editable = false;

  readonly #descriptionInput = createRef<HTMLTextAreaElement>();

  override render() {
    const isGenerating = this.state.status === "generating";
    const iconClasses = {
      "g-icon": true,
      "filled-heavy": true,
      round: true,
      rotate: isGenerating,
    };
    return html`
      <div id="container">
        <bb-expanding-textarea
          ${ref(this.#descriptionInput)}
          .disabled=${isGenerating || !this.editable}
          .classes=${"sans-flex w-400 md-body-large"}
          .orientation=${"vertical"}
          .value=${this.state.currentExampleIntent}
          .placeholder=${this.state.empty
            ? Strings.from("COMMAND_DESCRIBE_FRESH_FLOW_ALT")
            : Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
          @change=${this.#onInputChange}
          @focus=${this.#onInputFocus}
          @blur=${this.#onInputBlur}
          ><span class=${classMap(iconClasses)} slot="submit"
            >${isGenerating ? "progress_activity" : "send"}</span
          ></bb-expanding-textarea
        >
      </div>
    `;
  }

  // TODO: Reimplement with Signals
  // override async updated(changes: PropertyValues) {
  //   if (changes.has("#state") && this.#state.status === "error") {
  //     this.#descriptionInput.value?.focus();
  //     this.highlighted = true;
  //     setTimeout(() => (this.highlighted = false), 2500);
  //   }
  // }

  async #onInputChange() {
    const input = this.#descriptionInput.value;
    if (!input) {
      return;
    }

    const description = input?.value;
    if (!description) return;

    this.actionTracker?.flowGenEdit(this.state.graph?.url);

    this.state.startGenerating();

    const result = await this.controller?.generate(description);
    if (result && "error" in result) {
      this.#onGenerateError(result.error, result.suggestedIntent);
    } else {
      this.#clearInput();
    }
    this.state.finishGenerating();
  }

  #onGenerateError(error: string, suggestedIntent?: string) {
    // Special case: an ignorable error. We use this special case to handle the
    // case when the user isn't signed in and dismissed the sign in dialog
    if (error.length === 0) {
      return;
    }

    console.error("Error generating board", error);
    console.error("Suggested intent", suggestedIntent);

    this.state.status = "error";
    this.state.error = error;

    this.dispatchEvent(
      new SnackbarEvent(
        globalThis.crypto.randomUUID(),
        error,
        SnackType.INFORMATION,
        [
          {
            action: "copy",
            title: "Copy Prompt",
            value: suggestedIntent,
            callback: async () => {
              if (!suggestedIntent) {
                return;
              }

              await navigator.clipboard.writeText(suggestedIntent);
              this.dispatchEvent(new UnsnackbarEvent());
            },
          },
        ],
        true,
        true
      )
    );
  }

  #clearInput() {
    if (this.#descriptionInput.value) {
      this.#descriptionInput.value.value = "";
    }
  }

  #onInputFocus() {
    this.focused = true;
  }

  #onInputBlur() {
    this.focused = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-editor-input-lite": EditorInputLite;
  }
}
