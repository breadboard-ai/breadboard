/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { AppViewConfig } from "../../types/types";
import { provide } from "@lit/context";

import * as ConnectionClient from "@breadboard-ai/connection-client";
import * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { SettingsHelper } from "../../utils/settings.js";
import { GraphDescriptor } from "@google-labs/breadboard";
import { RunConfig } from "@google-labs/breadboard/harness";

@customElement("app-view")
export class AppView extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  @provide({ context: BreadboardUIContext.environmentContext })
  accessor environment: BreadboardUIContext.Environment;

  @provide({ context: BreadboardUIContext.tokenVendorContext })
  accessor tokenVendor: ConnectionClient.TokenVendor;

  @provide({ context: BreadboardUIContext.settingsHelperContext })
  accessor settingsHelper: SettingsHelper;

  #runConfig: RunConfig | null;
  #signInAdapter: SigninAdapter;

  constructor(
    private readonly config: AppViewConfig,
    private readonly flow: GraphDescriptor | null
  ) {
    super();

    this.environment = config.environment;
    this.tokenVendor = config.tokenVendor;
    this.settingsHelper = config.settingsHelper;
    this.#runConfig = config.runConfig;
    this.#signInAdapter = new SigninAdapter(
      this.tokenVendor,
      this.environment,
      this.settingsHelper
    );

    this.#setDocumentTitle();
  }

  #setDocumentTitle() {
    window.document.title = this.flow?.title ?? "App";
  }

  render() {
    if (!this.flow) {
      return html`404 not found`;
    }

    const appTemplate = this.config.template;
    console.log(this.#runConfig);

    appTemplate.graph = this.flow;
    // appTemplate.run = this.run;
    // appTemplate.topGraphResult = this.topGraphResult;
    appTemplate.eventPosition = 0;
    appTemplate.showGDrive = this.#signInAdapter.state === "valid";

    // if (this.#signInAdapter.state === "signedout") {
    //   return html`<app-connection-entry-signin
    //     .adapter=${this.#signInAdapter}
    //   ></app-connection-entry-signin>`;
    // }

    return html`${appTemplate}`;
  }
}
