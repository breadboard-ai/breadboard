/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as StringsHelper from "../../strings/helper.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GraphDescriptor, Outcome } from "@breadboard-ai/types";
import { StateEvent } from "../../events/events.js";
import "../../elements/input/expanding-textarea.js";
import { classMap } from "lit/directives/class-map.js";
import { ActionTracker } from "../../utils/action-tracker.js";
import { ok } from "@breadboard-ai/utils";
import { SignalWatcher } from "@lit-labs/signals";
import * as Styles from "../../styles/styles";
import { consume } from "@lit/context";
import { uiStateContext } from "../../contexts/ui-state.js";
import { LiteViewState, UI } from "../../state/types.js";

const Strings = StringsHelper.forSection("Editor");

export type LiteEditInputController = {
  generate(intent: string): Promise<Outcome<void>>;
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
            outline: 1px solid var(--light-dark-p-70);
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

  @property({ type: Object })
  accessor currentGraph: GraphDescriptor | undefined;

  @property({ type: Boolean, reflect: true })
  accessor focused = false;

  @property({ type: Boolean, reflect: true })
  accessor hasEmptyGraph = false;

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property()
  accessor controller: LiteEditInputController | undefined = undefined;

  @property()
  accessor flowGen!: LiteViewState;

  readonly #descriptionInput = createRef<HTMLTextAreaElement>();

  override render() {
    const isGenerating = this.flowGen.status === "generating";
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
          .value=${this.flowGen?.intent}
          .placeholder=${this.hasEmptyGraph
            ? Strings.from("COMMAND_DESCRIBE_FRESH_FLOW")
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

    this.flowGen.setIntent(description);

    this.flowGen.status = "generating";

    ActionTracker.flowGenEdit(this.currentGraph?.url);

    this.dispatchEvent(new StateEvent({ eventType: "host.lock" }));

    const result = await this.controller?.generate(description);
    if (!ok(result)) {
      this.#onGenerateError(result.$error);
    } else {
      this.#onGenerateComplete();
    }

    this.dispatchEvent(new StateEvent({ eventType: "host.unlock" }));
  }

  #onGenerateComplete() {
    this.flowGen.status = "initial";
    this.#clearInput();
  }

  #onGenerateError(error: string) {
    // TODO: Display error correctly.
    console.error("Error generating board", error);
    this.flowGen.status = "error";
    this.flowGen.error = error;
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
