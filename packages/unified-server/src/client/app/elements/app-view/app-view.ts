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
import { SettingsHelperImpl } from "../../utils/settings.js";
import {
  GraphDescriptor,
  InputValues,
  isStoredData,
} from "@google-labs/breadboard";
import { AppTemplateOptions } from "@breadboard-ai/shared-ui/types/types.js";
import { getThemeModeFromBackground } from "../../utils/color.js";
import { until } from "lit/directives/until.js";
import { TopGraphObserver } from "@breadboard-ai/shared-ui/utils/top-graph-observer";
import { InputEnterEvent } from "../../events/events.js";
import {
  RunEndEvent,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunLifecycleEvent,
  RunNextEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  RunSecretEvent,
  RunSkipEvent,
} from "@google-labs/breadboard/harness";

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
  accessor settingsHelper: SettingsHelperImpl;

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
    this.#initializeListeners();
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

    options.title = this.config.title;
    options.description = this.config.description;
    options.mode = getThemeModeFromBackground(
      this.config.theme.backgroundColor
    );
    options.theme = this.config.theme;
    options.additionalOptions =
      this.config.templateAdditionalOptions ?? undefined;

    if (this.config.theme?.splashScreen) {
      options.splashImage = true;
      options.isDefaultTheme = this.config.isDefautTheme;

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

  #initializeListeners() {
    if (!this.#runner) {
      return;
    }

    const harnessRunner = this.#runner?.harnessRunner;

    harnessRunner.addEventListener("start", (_evt: RunLifecycleEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("pause", (_evt: RunLifecycleEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("resume", (_evt: RunLifecycleEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("next", (_evt: RunNextEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("input", (_evt: RunInputEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("output", (_evt: RunOutputEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("secret", (_evt: RunSecretEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("error", (_evt: RunErrorEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("skip", (_evt: RunSkipEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("graphstart", (_evt: RunGraphStartEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("graphend", (_evt: RunGraphEndEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("nodestart", (_evt: RunNodeStartEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("nodeend", (_evt: RunNodeEndEvent) => {
      this.requestUpdate();
    });

    harnessRunner.addEventListener("end", (_evt: RunEndEvent) => {
      this.requestUpdate();
    });
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
      const run = runs[0] ?? null;

      appTemplate.state = this.#signInAdapter.state;
      appTemplate.graph = this.flow;
      appTemplate.run = run;
      appTemplate.topGraphResult =
        this.#runner.topGraphObserver.current() ??
        TopGraphObserver.entryResult(this.flow);
      appTemplate.eventPosition = run?.events.length ?? 0;
      appTemplate.showGDrive = this.#signInAdapter.state === "valid";
      appTemplate.addEventListener("bbsigninrequested", async () => {
        const url = await this.#signInAdapter.getSigninUrl();

        this.#signInAdapter.whenSignedIn(async (adapter) => {
          // The adapter is immutable, this callback will always return a new
          // copy with a new state, including picture and name.
          if (adapter.state === "valid") {
            this.#signInAdapter = adapter;
            requestAnimationFrame(() => {
              this.requestUpdate();
            });
          }
        });

        window.open(url, "_blank");
      });

      appTemplate.addEventListener("bbrun", async (evt: Event) => {
        evt.stopImmediatePropagation();

        if (!this.#runner) {
          return;
        }

        await this.#runner.harnessRunner.run();
      });

      appTemplate.addEventListener("bbstop", async (evt: Event) => {
        evt.stopImmediatePropagation();

        if (!this.#runner?.abortController) {
          return;
        }

        this.#runner.abortController.abort("User request");
        await this.#runner.harnessRunner.run();
        this.dispatchEvent(new Event("reset"));
      });

      appTemplate.addEventListener("bbinputenter", (evt: Event) => {
        evt.stopImmediatePropagation();

        if (!this.#runner) {
          return;
        }

        const inputEvent = evt as InputEnterEvent;
        let data = inputEvent.data as InputValues;

        if ("secret" in data) {
          const name = inputEvent.id;
          const value = data.secret;
          data = { [name]: value };
        }

        const runner = this.#runner.harnessRunner;

        if (!runner) {
          throw new Error("Can't send input, no runner");
        }

        if (runner.running()) {
          throw new Error("The runner is already running, cannot send input");
        }

        runner.run(data);
      });

      return html`${appTemplate}`;
    });

    return html`${until(run)}`;
  }
}
