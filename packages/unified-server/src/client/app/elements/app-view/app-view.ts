/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { AppViewConfig, Runner } from "../../types/types";
import { provide } from "@lit/context";

import * as ConnectionClient from "@breadboard-ai/connection-client";
import * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { SettingsHelper } from "../../utils/settings.js";
import { GraphDescriptor, isStoredData } from "@google-labs/breadboard";
import { AppTemplateOptions } from "@breadboard-ai/shared-ui/types/types.js";
import { getThemeModeFromBackground } from "../../utils/color.js";
import { until } from "lit/directives/until.js";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";

@customElement("app-view")
export class AppView extends LitElement {
  static styles = css`
    :host {
      display: block;

      /** Mobile for now */
      max-width: 420px;
      max-height: 920px;
    }
  `;

  @provide({ context: BreadboardUIContext.environmentContext })
  accessor environment: BreadboardUIContext.Environment;

  @provide({ context: BreadboardUIContext.tokenVendorContext })
  accessor tokenVendor: ConnectionClient.TokenVendor;

  @provide({ context: BreadboardUIContext.settingsHelperContext })
  accessor settingsHelper: SettingsHelper;

  #runner: Runner | null;
  #signInAdapter: SigninAdapter;

  constructor(
    private readonly config: AppViewConfig,
    private readonly flow: GraphDescriptor | null
  ) {
    super();

    this.environment = config.environment;
    this.tokenVendor = config.tokenVendor;
    this.settingsHelper = config.settingsHelper;
    this.#runner = config.runner;
    this.#signInAdapter = new SigninAdapter(
      this.tokenVendor,
      this.environment,
      this.settingsHelper
    );

    this.#setDocumentTitle();
    this.#applyThemeToTemplate();
  }

  #setDocumentTitle() {
    window.document.title = this.flow?.title ?? "App";
  }

  #splashImage = new Map<string, string>();
  #applyThemeToTemplate() {
    if (!this.flow || !this.config.theme) {
      return;
    }

    const options: AppTemplateOptions = {
      mode: "light",
      splashImage: false,
    };

    options.title =
      this.flow?.metadata?.visual?.presentation?.title ??
      this.flow?.title ??
      "Untitled App";
    options.description =
      this.flow?.metadata?.visual?.presentation?.description ??
      this.flow?.description ??
      null;
    options.mode = getThemeModeFromBackground(
      this.config.theme.backgroundColor
    );
    options.theme = this.config.theme;
    options.additionalOptions =
      this.config.templateAdditionalOptions ?? undefined;

    if (this.config.theme?.splashScreen) {
      options.splashImage = true;

      // Set the options here, then attempt to load the splash screen image.
      this.config.template.options = options;

      const splashScreen = this.config.theme.splashScreen;
      if (isStoredData(splashScreen)) {
        // Stored Data splash screen.
        Promise.resolve()
          .then(async () => {
            let url = splashScreen.storedData.handle;
            if (url.startsWith(".") && this.flow?.url) {
              url = new URL(url, this.flow?.url).href;
            }

            const cachedSplashImage = this.#splashImage.get(url);
            if (cachedSplashImage) {
              return cachedSplashImage;
            } else {
              this.#splashImage.clear();

              const response = await fetch(url);
              const data = await response.blob();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.addEventListener("loadend", () => {
                  const result = reader.result as string;
                  this.#splashImage.set(url, result);
                  resolve(result);
                });
                reader.readAsDataURL(data);
              });
            }
          })
          .then((base64DataUrl) => {
            if (!this.config.template) {
              return;
            }
            options.splashImage = `url(${base64DataUrl})`;
            this.config.template.options = { ...options };
          });
      } else {
        // Inline Data splash screen.
        const splashScreenData = splashScreen.inlineData;
        options.splashImage = `url(data:${splashScreenData.mimeType};base64,${splashScreenData.data})`;
        this.config.template.options = { ...options };
      }
    } else {
      options.splashImage = false;
      this.config.template.options = options;
    }
  }

  render() {
    if (!this.flow || !this.#runner) {
      return html`404 not found`;
    }

    const run = this.#runner.runObserver.runs().then((runs) => {
      if (!this.flow || !this.#runner) {
        return html`404 not found`;
      }

      const appTemplate = this.config.template;

      appTemplate.graph = this.flow;
      appTemplate.run = runs[0] ?? null;
      appTemplate.topGraphResult =
        this.#runner.topGraphObserver.current() ??
        TopGraphObserver.entryResult(this.flow);
      appTemplate.eventPosition = 0;
      appTemplate.showGDrive = this.#signInAdapter.state === "valid";

      return html`${appTemplate}`;
    });

    // if (this.#signInAdapter.state === "signedout") {
    //   return html`<app-connection-entry-signin
    //     .adapter=${this.#signInAdapter}
    //   ></app-connection-entry-signin>`;
    // }

    return html`${until(run)}`;
  }
}
