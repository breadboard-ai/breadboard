/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsentType, ConsentUIType, OnDemandUI } from "@breadboard-ai/types";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { INTERCEPT_POPUPS_SCRIPT } from "./app-sandbox-intercept-popups.js";
import {
  type AppSandboxSrcDocMessage,
  type AppSandboxOnDemandCallbackMessage,
  isAppSandboxReadyMessage,
  type AppSandboxRequestOpenPopupMessage,
  isAppSandboxRequestOpenPopupMessage,
  isAppSandboxOnDemandCallbackMessage,
} from "./app-sandbox-protocol.js";
import { buildOnDemandScript } from "./app-sandbox-on-demand.js";
import { scaContext } from "../sca/context/context.js";
import { SCA } from "../sca/sca.js";

/**
 * This element manages an outer iframe, which itself contains an inner iframe.
 *
 * The inner iframe is what renders the generated HTML srcdoc, which it receives
 * over postMessage.
 *
 * The outer iframe exists purely so that we can serve a different CSP for the
 * inner iframe vs the CSP of the main app, because a different server
 * Content-Security-Policy for the iframe host is the only way to do this
 * currently.
 *
 * The inner CSP adds access to some common CDNs, removes access to some
 * resources needed only by the main app, and disables trusted types. We disable
 * trusted types because generated apps do not currently know how to support
 * them, and we accept this because the inner iframe is isolated from sensitive
 * resources at this outer origin using a sandbox with null origin (see
 * `app-sandbox.html`).
 *
 * After the
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/csp
 * attribute ships in all browsers, we should be able to use that with a single
 * iframe layer instead.
 */
@customElement("bb-app-sandbox")
export class AppSandbox extends SignalWatcher(LitElement) {
  @property() accessor srcdoc = "";
  @property() accessor graphUrl = "";
  @property({ attribute: false }) accessor onDemandInfo: OnDemandUI | undefined;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  readonly #iframe = createRef<HTMLIFrameElement>();
  get #iframeContentWindow() {
    return this.#iframe.value?.contentWindow;
  }

  static styles = css`
    :host {
      display: contents;
    }
    iframe {
      width: 100%;
      height: 100%;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.#handleMessageFromIframe);
  }

  override render() {
    return html`
      <iframe
        part="iframe"
        src="/_app/_app-sandbox/"
        ${ref(this.#iframe)}
        frameborder="0"
        sandbox="allow-scripts allow-forms allow-same-origin"
      ></iframe>
    `;
  }

  override updated(changes: PropertyValues<this>) {
    if (
      (changes.has("srcdoc") || changes.has("onDemandInfo")) &&
      this.#iframeContentWindow
    ) {
      console.debug("[app-sandbox-element] Sending updated srcdoc");
      this.#sendSrcdocToIframe();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("message", this.#handleMessageFromIframe);
  }

  #sendSrcdocToIframe() {
    const onDemandScript = this.onDemandInfo
      ? buildOnDemandScript(this.onDemandInfo)
      : "";
    this.#iframeContentWindow?.postMessage(
      {
        type: "app-sandbox-srcdoc",
        srcdoc: INTERCEPT_POPUPS_SCRIPT + this.srcdoc + onDemandScript,
      } satisfies AppSandboxSrcDocMessage,
      window.location.origin
    );
  }

  readonly #handleMessageFromIframe = async (event: MessageEvent) => {
    if (
      event.isTrusted &&
      event.source &&
      event.source === this.#iframeContentWindow &&
      event.origin === window.location.origin
    ) {
      if (isAppSandboxReadyMessage(event.data)) {
        console.debug(
          "[app-sandbox-element] Received ready message, sending srcdoc"
        );
        this.#sendSrcdocToIframe();
      } else if (isAppSandboxRequestOpenPopupMessage(event.data)) {
        this.#onIframeRequestOpenPopup(event.data);
      } else if (isAppSandboxOnDemandCallbackMessage(event.data)) {
        this.#onIframeOnDemandCallback(event.data);
      }
    }
  };

  async #onIframeRequestOpenPopup({ url }: AppSandboxRequestOpenPopupMessage) {
    if (!this.sca || !this.graphUrl) {
      return;
    }
    const allow = await this.sca.controller.global.consent.queryConsent(
      {
        graphUrl: this.graphUrl,
        type: ConsentType.OPEN_WEBPAGE,
        scope: new URL(url).origin,
      },
      ConsentUIType.MODAL
    );
    if (allow) {
      window.open(url, "_blank", "noreferrer");
    }
  }

  #onIframeOnDemandCallback({ result }: AppSandboxOnDemandCallbackMessage) {
    if (this.onDemandInfo) {
      console.debug(
        "[app-sandbox-element] Received on-demand callback, resolving",
        result
      );
      this.onDemandInfo.callback(result);
    }
  }
}
