/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { AppViewConfig, Runner } from "../../types/types";
import { provide } from "@lit/context";
import { Task } from "@lit/task";
import { map } from "lit/directives/map.js";

import * as ConnectionClient from "@breadboard-ai/connection-client";
import * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import {
  SIGN_IN_CONNECTION_ID,
  SigninAdapter,
} from "@breadboard-ai/shared-ui/utils/signin-adapter.js";
import { SettingsHelperImpl } from "@breadboard-ai/shared-ui/data/settings-helper.js";
import {
  BoardServer,
  err,
  GraphDescriptor,
  InputValues,
  isStoredData,
  ok,
  Outcome,
} from "@google-labs/breadboard";
import {
  AppTemplate,
  AppTemplateOptions,
  SnackType,
  TopGraphRunResult,
} from "@breadboard-ai/shared-ui/types/types.js";
import { getThemeModeFromBackground } from "../../utils/color.js";
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
import { googleDriveClientContext } from "@breadboard-ai/shared-ui/contexts/google-drive-client-context.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { loadImage } from "@breadboard-ai/shared-ui/utils/image.js";
import { boardServerContext } from "@breadboard-ai/shared-ui/contexts/board-server.js";
import { blobHandleToUrl } from "@breadboard-ai/shared-ui/utils/blob-handle-to-url.js";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  type ClientDeploymentConfiguration,
  clientDeploymentConfigurationContext,
} from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { projectRunContext } from "@breadboard-ai/shared-ui/contexts";
import { ProjectRun } from "@breadboard-ai/shared-ui/state/types.js";

@customElement("app-view")
export class AppView extends LitElement {
  static styles = css`
    :host {
      display: block;
      container-type: size;
    }

    bb-connection-entry-signin {
      width: 100%;
      height: 100%;
    }
  `;

  @provide({ context: BreadboardUIContext.environmentContext })
  accessor environment: BreadboardUIContext.Environment;

  @provide({ context: clientDeploymentConfigurationContext })
  accessor clientDeploymentConfiguration: ClientDeploymentConfiguration;

  @provide({ context: BreadboardUIContext.tokenVendorContext })
  accessor tokenVendor: ConnectionClient.TokenVendor;

  @provide({ context: BreadboardUIContext.settingsHelperContext })
  accessor settingsHelper: SettingsHelperImpl;

  @provide({ context: googleDriveClientContext })
  accessor googleDriveClient: GoogleDriveClient;

  @provide({ context: boardServerContext })
  accessor boardServer: BoardServer | undefined;

  @provide({ context: projectRunContext })
  accessor projectRun: ProjectRun | null = null;

  readonly flow: GraphDescriptor;
  #runner: Runner | null;
  #signInAdapter: SigninAdapter;
  #overrideTopGraphRunResult: TopGraphRunResult | null;
  #snackbarRef: Ref<BreadboardUI.Elements.Snackbar> = createRef();

  constructor(
    private readonly config: AppViewConfig,
    earlyLoadedFlow: GraphDescriptor | null
  ) {
    super();

    this.environment = config.environment;
    this.clientDeploymentConfiguration = config.clientDeploymentConfiguration;
    this.tokenVendor = config.tokenVendor;
    this.settingsHelper = config.settingsHelper;
    this.#runner = config.runner;
    this.#signInAdapter = config.signinAdapter;
    this.flow = earlyLoadedFlow ?? config.flow;
    this.googleDriveClient = config.googleDriveClient;
    this.boardServer = config.boardServer;
    this.projectRun = config.projectRun;
    this.#overrideTopGraphRunResult = config.runResults
      ? {
          status: "stopped",
          log: [
            {
              type: "edge",
              value: config.runResults.finalOutputValues,
              end: null,
            },
          ],
          graph: null,
          currentNode: null,
          edgeValues: {
            get: () => undefined,
            current: null,
          },
          nodeInformation: {
            getActivity: () => undefined,
            canRunNode: () => false,
          },
        }
      : null;

    this.#setDocumentTitle();
    this.#applyThemeToTemplate();
    this.#initializeListeners();
  }

  readonly #toasts = new Map<
    string,
    {
      message: string;
      type: BreadboardUI.Events.ToastType;
      persistent: boolean;
    }
  >();

  #toast(
    message: string,
    type: BreadboardUI.Events.ToastType,
    persistent = false,
    id = globalThis.crypto.randomUUID()
  ) {
    if (message.length > 77) {
      message = message.slice(0, 74) + "...";
    }

    this.#toasts.set(id, { message, type, persistent });
    this.requestUpdate();

    return id;
  }

  #snackbar(
    message: string,
    type: BreadboardUI.Types.SnackType,
    actions: BreadboardUI.Types.SnackbarAction[] = [],
    persistent = false,
    id = globalThis.crypto.randomUUID(),
    replaceAll = false
  ) {
    if (!this.#snackbarRef.value) {
      return;
    }

    return this.#snackbarRef.value.show(
      {
        id,
        message,
        type,
        persistent,
        actions,
      },
      replaceAll
    );
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
            const url = blobHandleToUrl(splashScreen.storedData.handle)?.href;
            if (!url) {
              return "";
            }

            const cachedSplashImage = this.#splashImage.get(url);
            if (cachedSplashImage) {
              return cachedSplashImage;
            } else {
              this.#splashImage.clear();

              const imageData = await loadImage(this.googleDriveClient!, url);
              if (imageData) {
                this.#splashImage.set(url, imageData);
              }
              return imageData;
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

    harnessRunner.addEventListener("secret", async (evt: RunSecretEvent) => {
      const key = evt.data.keys.at(0);
      const name = `connection:${SIGN_IN_CONNECTION_ID}`;
      if (key !== name) {
        console.warn(
          `Invalid secret values. Only "${name}" is supported`,
          evt.data.keys
        );
        return;
      }
      const token = await this.getAccessToken();
      if (!ok(token)) {
        console.warn(token.$error);
        return;
      }
      this.#runner?.harnessRunner.run({ [name]: token });
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

  async getAccessToken(): Promise<Outcome<string>> {
    if (this.#signInAdapter.state !== "valid") {
      const refreshed = await this.#signInAdapter.refresh();
      if (refreshed?.state !== "valid") {
        console.error("Unable to get valid Auth token");
        return err("unable to get token");
      } else {
        return refreshed.grant.access_token;
      }
    } else {
      return this.#signInAdapter.accessToken()!;
    }
  }

  readonly #initializeAppTemplate = new Task(this, {
    args: () => [this.config.template],
    task: async ([appTemplate]): Promise<AppTemplate> => {
      appTemplate.showDisclaimer = true;
      appTemplate.graph = this.flow;

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

      appTemplate.addEventListener("bbsharerequested", async () => {
        await navigator.clipboard.writeText(window.location.href);
        this.#snackbar("Copied URL to clipboard", SnackType.INFORMATION);
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

      appTemplate.addEventListener("bbinputenter", async (evt: Event) => {
        evt.stopImmediatePropagation();

        if (!this.#runner) {
          return;
        }

        const inputEvent = evt as InputEnterEvent;
        const data = inputEvent.data as InputValues;

        if ("secret" in data) {
          console.warn("Unexpected secret input", data);
        }

        const runner = this.#runner.harnessRunner;

        if (!runner) {
          throw new Error("Can't send input, no runner");
        }

        if (!runner.running()) {
          runner.run(data);
        }
      });

      appTemplate.addEventListener(
        "bbtoast",
        (toastEvent: BreadboardUI.Events.ToastEvent) =>
          this.#toast(toastEvent.message, toastEvent.toastType)
      );

      return appTemplate;
    },
  });

  render() {
    return [
      this.#renderAppTemplate(),
      this.#renderToasts(),
      this.#renderSnackbar(),
    ];
  }

  #renderAppTemplate() {
    if (!this.flow || !this.#runner) {
      return html`404 not found`;
    }
    return this.#initializeAppTemplate.render({
      pending: () => nothing,
      error: () => `An unexpected error occured`,
      complete: (appTemplate) => {
        appTemplate.state = this.#signInAdapter.state;
        appTemplate.topGraphResult =
          this.#overrideTopGraphRunResult ??
          this.#runner?.topGraphObserver.current() ??
          TopGraphObserver.entryResult(this.flow);
        appTemplate.showGDrive = this.#signInAdapter.state === "valid";
        return appTemplate;
      },
    });
  }

  #renderToasts() {
    return map(
      this.#toasts,
      ([toastId, { message, type, persistent }], idx) => {
        const offset = this.#toasts.size - idx - 1;
        return html`<bb-toast
          .toastId=${toastId}
          .offset=${offset}
          .message=${message}
          .type=${type}
          .timeout=${persistent ? 0 : nothing}
          @bbtoastremoved=${(evt: BreadboardUI.Events.ToastRemovedEvent) => {
            this.#toasts.delete(evt.toastId);
          }}
        ></bb-toast>`;
      }
    );
  }

  #renderSnackbar() {
    return html`<bb-snackbar ${ref(this.#snackbarRef)}></bb-snackbar>`;
  }
}
