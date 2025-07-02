/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import {
  type ClientDeploymentConfiguration,
  clientDeploymentConfigurationContext,
} from "../../config/client-deployment-configuration.js";
import { type BuildInfo, buildInfoContext } from "../../contexts/build-info.js";
import { icons } from "../../styles/icons.js";
import { spinAnimationStyles } from "../../styles/spin-animation.js";

type UserFeedbackApi = {
  startFeedback(
    configuration: {
      productId: string;
      bucket?: string;
      productVersion?: string;
      callback?: () => void;
      onLoadCallback?: () => void;
    },
    productData?: { [key: string]: string }
  ): void;
};

type WindowWithUserFeedbackApi = Window &
  typeof globalThis & {
    userfeedback: { api: UserFeedbackApi };
  };

let googleFeedbackApiPromise;
function loadGoogleFeedbackApi(): Promise<UserFeedbackApi> {
  return (googleFeedbackApiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://support.google.com/inapp/api.js";
    script.async = true;
    script.addEventListener(
      "load",
      () => resolve((window as WindowWithUserFeedbackApi).userfeedback.api),
      { once: true }
    );
    script.addEventListener("error", (reason) => reject(reason), {
      once: true,
    });
    document.body.appendChild(script);
  }));
}

type State = { status: "closed" } | { status: "loading" } | { status: "open" };

@customElement("bb-feedback-panel")
export class FeedbackPanel extends LitElement {
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
        width: 412px;
        height: 100vh;
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
          color: var(--bb-ui-600);
          margin-right: var(--bb-grid-size-2);
        }
      }
    `,
  ];

  @consume({ context: clientDeploymentConfigurationContext })
  accessor clientDeploymentConfiguration:
    | ClientDeploymentConfiguration
    | undefined;

  @consume({ context: buildInfoContext })
  accessor buildInfo: BuildInfo | undefined;

  @state()
  accessor #state: State = { status: "closed" };

  readonly #loadingPanel: Ref<HTMLDialogElement> = createRef();

  override render() {
    const { status } = this.#state;
    if (status === "loading") {
      return this.#renderLoadingPanel();
    }
    // When open, we're not in control of rendering at all, it's not a component
    // we control.
    status satisfies "open" | "closed";
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
    this.#state = { status: "closed" };
  }

  override updated() {
    if (this.#state.status === "loading") {
      const panel = this.#loadingPanel.value;
      if (panel) {
        panel.showModal();
      } else {
        console.error(`Loading panel was not rendered`);
      }
    }
  }

  async open() {
    if (this.#state.status !== "closed") {
      return;
    }

    if (!this.clientDeploymentConfiguration) {
      console.error(`No client deployment configuration was provided.`);
      return;
    }
    const productId =
      this.clientDeploymentConfiguration.GOOGLE_FEEDBACK_PRODUCT_ID;
    if (!productId) {
      console.error(
        `No GOOGLE_FEEDBACK_PRODUCT_ID was set` +
          ` in the client deployment configuration.`
      );
      return;
    }
    const bucket = this.clientDeploymentConfiguration.GOOGLE_FEEDBACK_BUCKET;
    if (!bucket) {
      console.error(
        `No GOOGLE_FEEDBACK_BUCKET was set` +
          ` in the client deployment configuration.`
      );
      return;
    }
    if (!this.buildInfo) {
      console.error(`No build info was provided.`);
      return;
    }
    const { packageJsonVersion: version, gitCommitHash } = this.buildInfo;

    this.#state = { status: "loading" };
    let api;
    try {
      api = await loadGoogleFeedbackApi();
    } catch (e) {
      console.error(`Error loading Google Feedback script: ${e}`);
      this.#state = { status: "closed" };
      return;
    }
    if (this.#state.status !== "loading") {
      // The user might have pressed Escape on the loading panel in the
      // meantime.
      return;
    }
    api.startFeedback({
      productId,
      bucket,
      productVersion: `${version} (${gitCommitHash})`,
      onLoadCallback: () => {
        // Note that the API we loaded earlier is very tiny. This startFeedback
        // call is what actually loads most of the JavaScript, so we want to
        // keep the loading indicator visible until this callback fires.
        this.#state = { status: "open" };
      },
      callback: () => {
        this.#state = { status: "closed" };
      },
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-feedback-panel": FeedbackPanel;
  }
}
