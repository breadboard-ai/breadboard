/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { icons } from "../../styles/icons.js";
import { spinAnimationStyles } from "../../styles/spin-animation.js";
import { appControllerContext } from "../../../controller/context/context.js";
import { AppController } from "../../../controller/controller.js";
import { SignalWatcher } from "@lit-labs/signals";

@customElement("bb-feedback-panel")
export class FeedbackPanel extends SignalWatcher(LitElement) {
  static readonly styles = [
    icons,
    spinAnimationStyles,
    css`
      :host {
        display: contents;
      }
      #loading-panel {
        /* These styles make the loading dialog look very similar to the
           Feedback component which will shortly take its place, and whose
           styles we don't control. */
        box-sizing: border-box;
        width: 412px;
        height: 100vh;
        max-height: none;
        margin: 0 0 0 auto;
        border: none;
        border-radius: 8px 0 0 8px;
        overflow: hidden;
        box-shadow:
          0 1px 3px 0 rgba(48, 48, 48, 0.302),
          0 4px 8px 3px rgba(48, 48, 48, 0.149);

        display: flex;
        align-items: center;
        justify-content: center;
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);

        .g-icon {
          animation: spin 1s linear infinite;
          color: var(--light-dark-p-40);
          margin-right: var(--bb-grid-size-2);
        }

        &::backdrop {
          background: rgba(128, 134, 139, 0.5);
        }
      }
    `,
  ];

  @consume({ context: appControllerContext })
  accessor #appController!: AppController;

  readonly #loadingPanel: Ref<HTMLDialogElement> = createRef();

  override render() {
    if (!this.#appController) return nothing;
    const status = this.#appController.global.feedback.status;
    if (status === "loading") {
      return this.#renderLoadingPanel();
    }
    // When open, we're not in control of rendering at all, it's not a component
    // we control.
    return nothing;
  }

  #renderLoadingPanel() {
    return html`
      <dialog
        id="loading-panel"
        ${ref(this.#loadingPanel)}
        @close=${this.#onLoadingPanelClose}
      >
        <span class="g-icon">progress_activity</span>
        Loading ...
      </dialog>
    `;
  }

  #onLoadingPanelClose() {
    this.#appController.global.feedback.close();
  }

  override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (!this.#appController) return;

    if (this.#appController.global.feedback.status === "loading") {
      const panel = this.#loadingPanel.value;
      if (panel) {
        panel.showModal();
      } else {
        console.error(`Loading panel was not rendered`);
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-feedback-panel": FeedbackPanel;
  }
}
