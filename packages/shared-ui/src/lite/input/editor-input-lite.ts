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
import { uiStateContext } from "../../contexts/ui-state.js";
import "../../elements/input/expanding-textarea.js";
import { SnackbarEvent } from "../../events/events.js";
import { OneShotFlowGenFailureResponse } from "../../flow-gen/flow-generator.js";
import { LiteViewState, UI } from "../../state/types.js";
import * as StringsHelper from "../../strings/helper.js";
import * as Styles from "../../styles/styles";
import { SnackType } from "../../types/types.js";
import { ActionTracker } from "../../utils/action-tracker.js";

const Strings = StringsHelper.forSection("Editor");

export type LiteEditInputController = {
  generate(intent: string): Promise<OneShotFlowGenFailureResponse | undefined>;
};

@customElement("bb-editor-input-lite")
export class EditorInputLite extends SignalWatcher(LitElement) {
  @consume({ context: uiStateContext })
  accessor uiState!: UI;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColors.baseColors,
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

        & bb-expanding-textarea {
          --min-lines: 1;
          --max-lines: 4;
          --padding: var(--bb-grid-size-3);
          --border-color: var(--light-dark-n-90);
          --border-radius: var(--bb-grid-size-6);

          &:focus-within {
            outline: 1px solid var(--light-dark-n-70);
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
  accessor state!: LiteViewState;

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
          .disabled=${isGenerating}
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

    this.state.setIntent(description);

    ActionTracker.flowGenEdit(this.state.graph?.url);

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
    console.error("Error generating board", error);
    console.error("Suggested intent", suggestedIntent);
    this.state.status = "error";
    this.state.error = error;

    this.dispatchEvent(
      new SnackbarEvent(
        globalThis.crypto.randomUUID(),
        error,
        SnackType.INFORMATION,
        [],
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
