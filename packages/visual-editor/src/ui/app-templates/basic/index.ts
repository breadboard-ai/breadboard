/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import {
  html,
  HTMLTemplateResult,
  LitElement,
  nothing,
  PropertyValues,
} from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  AppTemplate,
  AppTemplateOptions,
  FloatingInputFocusState,
} from "../../types/types.js";
import { SnackType, ToastType } from "../../../sca/types.js";

// Custom Elements for the App.
import "./a2ui-custom-elements/index.js";
import "./header/header.js";

import { SignalWatcher } from "@lit-labs/signals";
import { consume, provide } from "@lit/context";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import * as A2UI from "../../../a2ui/0.8/ui/ui.js";
import { v0_8 } from "../../../a2ui/index.js";
import * as Theme from "../../../theme/index.js";
import {
  theme as a2uiTheme,
  applyTokens,
} from "../../a2ui-theme/a2ui-theme.js";

import {
  ResizeEvent,
  ShareRequestedEvent,
  SnackbarEvent,
  StateEvent,
  UnsnackbarEvent,
} from "../../events/events.js";
import { emptyStyles } from "../../styles/host/colors-empty.js";
import { appScreenToA2UIProcessor } from "../shared/utils/app-screen-to-a2ui.js";
import { styles as appStyles } from "./index.styles.js";

import {
  DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY,
  DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN,
} from "@breadboard-ai/utils/google-drive/operations.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/utils/google-drive/utils.js";
import { createRef, ref } from "lit/directives/ref.js";

import { markdown } from "../../directives/markdown.js";
import { makeUrl, parseUrl } from "../../navigation/urls.js";

import {
  AppScreenOutput,
  ConsentAction,
  GraphDescriptor,
  RuntimeFlags,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { GoogleDriveBoardServer } from "../../../board-server/server.js";
import { isInlineData, isLLMContentArray } from "../../../data/common.js";
import { inlineAllContent } from "../../../data/inline-all-content.js";
import {
  extensionFromMimeType,
  saveOutputsAsFile,
} from "../../../data/save-outputs-as-file.js";

import { maybeTriggerNlToOpalSatisfactionSurvey } from "../../survey/nl-to-opal-satisfaction-survey.js";
import { CONSENT_RENDER_INFO } from "../../utils/consent-content-items.js";
import { isDocSlidesOrSheetsOutput } from "../../../a2/a2/utils.js";
import { scaContext } from "../../../sca/context/context.js";
import { SCA } from "../../../sca/sca.js";
import { AppScreenPresenter } from "../../presenters/app-screen-presenter.js";

function getHTMLOutput(screen: AppScreenOutput): string | null {
  const outputs = Object.values(screen.output);
  const singleOutput = outputs.length === 1;
  if (!singleOutput) {
    return null;
  }

  const maybeOutputArray = outputs[0];
  if (isLLMContentArray(maybeOutputArray) && maybeOutputArray.length === 1) {
    const output = maybeOutputArray[0];
    if (output.parts.length === 1) {
      const firstPart = output.parts[0];
      if (
        isInlineData(firstPart) &&
        firstPart.inlineData.mimeType === "text/html"
      ) {
        return firstPart.inlineData.data;
      }
    }
  }

  return null;
}

const parsedUrl = parseUrl(window.location.href);

@customElement("app-basic")
export class Template extends SignalWatcher(LitElement) implements AppTemplate {
  @property({ type: Object })
  accessor options: AppTemplateOptions = {
    title: "Untitled App",
    mode: "light",
    splashImage: false,
  };

  @provide({ context: A2UI.Context.themeContext })
  accessor a2uitheme: v0_8.Types.Theme = a2uiTheme;

  connectedCallback(): void {
    super.connectedCallback();
    applyTokens(this, this.a2uitheme.tokens);
    this.#appPresenter.connect(this.sca);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#appPresenter.disconnect();
  }

  @state()
  @consume({ context: scaContext })
  accessor sca!: SCA;

  readonly #appPresenter = new AppScreenPresenter();

  @property()
  accessor focusWhenIn: FloatingInputFocusState = ["app"];

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor runtimeFlags: RuntimeFlags | null = null;

  @property()
  accessor showGDrive = false;

  @property({ reflect: true, type: Boolean })
  accessor isRefreshingAppTheme = false;

  @property()
  accessor isFreshGraph = false;

  @property()
  accessor isEmpty = false;

  @property()
  accessor disclaimerContent: HTMLTemplateResult | string = "";

  @property({ reflect: true, type: Boolean })
  accessor hasRenderedSplash = false;

  @property({ reflect: true, type: Boolean })
  accessor showShareButton = true;

  @property()
  accessor readOnly = true;

  @property()
  accessor headerConfig: {
    replay: boolean;
    menu: boolean;
    fullscreen: "available" | "active" | null;
    small: boolean;
  } = {
    replay: true,
    menu: true,
    fullscreen: null,
    small: false,
  };

  @state()
  accessor showAddAssetModal = false;

  @state()
  accessor resultsUrl: string | null = null;

  @query("#export-output-button")
  accessor exportOutputsButton: HTMLButtonElement | null = null;

  readonly #shareResultsButton = createRef<HTMLButtonElement>();

  get additionalOptions() {
    return {
      font: {
        values: [
          { title: "Sans-serif", value: "sans-serif" } /* Default */,
          { title: "Serif", value: "serif" },
        ],
        title: "Font",
      },
      fontStyle: {
        values: [
          { title: "Normal", value: "normal" } /* Default */,
          { title: "Italic", value: "italic" },
        ],
        title: "Font Style",
      },
    };
  }

  static styles = appStyles;

  constructor() {
    super();
  }

  #renderControls() {
    return html`<bb-app-header
      .isEmpty=${this.isEmpty}
      .progress=${this.sca.controller.run.main.progress}
      .replayActive=${this.headerConfig.replay}
      .menuActive=${this.headerConfig.menu}
      .fullScreenActive=${this.headerConfig.fullscreen}
      .small=${this.headerConfig.small}
      .appTitle=${this.graph?.title}
    ></bb-app-header>`;
  }

  #renderOutputs() {
    let activityContents:
      | HTMLTemplateResult
      | Array<HTMLTemplateResult | symbol>
      | symbol = nothing;
    const lastScreen = this.#appPresenter.last;
    const last = lastScreen?.last;
    if (last) {
      const htmlOutput = getHTMLOutput(last);
      if (htmlOutput !== null) {
        activityContents = html`
          <bb-app-sandbox
            .srcdoc=${htmlOutput}
            .graphUrl=${this.graph?.url ?? ""}
          ></bb-app-sandbox>
        `;
      } else {
        let processor;
        let receiver;

        // A2UI payload received.
        if (last.a2ui) {
          processor = last.a2ui.processor;
          receiver = last.a2ui.receiver;
        } else {
          // Likely a raw LLM Content that needs to be converted to A2UI.
          processor = appScreenToA2UIProcessor(last, lastScreen?.type);
          receiver = null;
        }

        activityContents = html`<section id="surfaces">
          <bb-a2ui-client-view
            .processor=${processor}
            .receiver=${receiver}
            @a2uistatus=${(evt: v0_8.Events.StateEvent<"a2ui.status">) => {
              const STATUS_TO_TOAST: Record<string, ToastType> = {
                pending: ToastType.PENDING,
                success: ToastType.INFORMATION,
                error: ToastType.ERROR,
              };
              this.sca.controller.global.toasts.toast(
                evt.detail.message,
                STATUS_TO_TOAST[evt.detail.status] ?? ToastType.INFORMATION,
                false,
                evt.detail.id
              );
            }}
          >
          </bb-a2ui-client-view>
        </section>`;
      }
    }

    return html`<div id="activity">${[activityContents]}</div>`;
  }
  #renderProgress(active: boolean) {
    const titles = Array.from(this.#appPresenter.current.values()).map(
      (screen) => {
        if (!screen.progress) return screen.title;
        if (screen.progressCompletion < 0) return screen.progress;
        return `${screen.progress}: ${screen.progressCompletion}%`;
      }
    );

    const titleList = new Intl.ListFormat("en-US", {
      style: "long",
      type: "conjunction",
    }).format(titles);

    return html`<div id="progress" class=${classMap({ active })}>
      <div class="thoughts">
        <bb-shape-morph></bb-shape-morph>
        <h1 class="w-700 round sans-flex md-title-large">Thinking...</h1>
        <div class="thought-content sans md-body-large">
          ${markdown(titleList ?? "")}
        </div>
      </div>
    </div>`;
  }

  #renderError() {
    const error = this.sca.controller.run.main.error;
    if (!error) {
      console.warn("Asked to render error, but no error was found");
      return nothing;
    }
    const errorId = crypto.randomUUID();
    const details = [];

    if (error.details) {
      details.push({
        action: "details",
        title: "View details",
        value: html`${markdown(error.details)}`,
      });
    }

    this.dispatchEvent(
      new SnackbarEvent(
        errorId,
        error.message,
        SnackType.ERROR,
        details,
        true,
        true
      )
    );

    const activityContents = html`<section class="error">
      <h1 class="w-700 sans-flex round md-headline-large">
        Oops, something went wrong
      </h1>
    </section>`;

    return html`<div id="activity">${[activityContents]}</div>`;
  }

  #renderConsent() {
    const requests = this.sca.controller.global.consent.pendingInApp;
    if (!requests || requests.length === 0) {
      return nothing;
    }

    const consentRequest = requests[0];
    const renderInfo = CONSENT_RENDER_INFO[consentRequest.request.type];

    // TypeScript struggles to disambiguate this, so marking it as `any`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detypedConsentRequest = consentRequest as any;
    return html`
      <div id="consent" class="default">
        <section id="consent-content-container">
          <h1>${renderInfo.name}</h1>
          ${renderInfo.description(detypedConsentRequest)}
          <button
            id="grant-consent"
            @click=${() => {
              this.sca.controller.global.consent.updatePendingRequest(
                consentRequest,
                ConsentAction.ALWAYS_ALLOW
              );
            }}
          >
            Allow Access
          </button>
        </section>
      </div>
    `;
  }

  #renderEmptyState() {
    return html`<div id="activity">
      <p class="sans-flex round filled md-title-medium empty-state">
        ${Strings.from("LABEL_EMPTY")}
      </p>
    </div>`;
  }

  #renderSaveResultsButtons() {
    if (!this.#appPresenter.finalOutput) {
      return nothing;
    }

    this.style.setProperty("--input-clearance", `0px`);

    const allowSharingOutputs = !parsedUrl.lite;

    const isBtnDisabled = isDocSlidesOrSheetsOutput(
      this.#appPresenter.finalOutput
    );

    return html`
      <div id="save-results-button-container">
        ${allowSharingOutputs
          ? this.resultsUrl
            ? html`<button
                id="save-results-button"
                class="sans-flex w-500 round md-body-medium"
                @click=${this.#onClickCopyShareUrl}
              >
                <span class="g-icon filled round">content_copy</span>
                Copy share URL
              </button>`
            : html`<button
                id="save-results-button"
                ?disabled=${isBtnDisabled}
                class="sans-flex w-500 round md-body-medium"
                @click=${this.#onClickSaveResults}
                ${ref(this.#shareResultsButton)}
              >
                <span class="g-icon filled round">share</span>
                Share output
              </button>`
          : nothing}
        <button
          id="export-output-button"
          ?disabled=${isBtnDisabled}
          @click=${this.#onClickExportOutput}
          class="sans-flex w-500 round md-body-medium"
        >
          <span class="g-icon filled round">file_save</span>
          Download file
        </button>
      </div>
    `;
  }

  async #onClickCopyShareUrl(evt: Event) {
    if (!(evt.target instanceof HTMLButtonElement) || !this.resultsUrl) {
      return;
    }

    await navigator.clipboard.writeText(decodeURIComponent(this.resultsUrl));

    this.sca.services.actionTracker?.shareResults("copy_share_link");

    this.dispatchEvent(
      new SnackbarEvent(
        globalThis.crypto.randomUUID(),
        `Share link copied to clipboard`,
        SnackType.INFORMATION,
        [],
        false,
        true
      )
    );
  }

  async #onClickExportOutput() {
    const btn = this.exportOutputsButton;
    if (!btn) {
      console.error("No export output button");
      return;
    }

    lockButton();

    if (!this.sca) {
      console.error(`No SCA`);
      unlockButton();
      return;
    }

    const currentGraphUrl = this.graph?.url;
    if (!currentGraphUrl) {
      console.error(`No graph url`);
      unlockButton();
      return;
    }

    if (!this.#appPresenter.finalOutput) {
      unlockButton();
      return;
    }

    const boardServer = this.sca.services.googleDriveBoardServer;
    if (!boardServer) {
      console.error(`No board server`);
      unlockButton();
      return;
    }

    if (!(boardServer instanceof GoogleDriveBoardServer)) {
      console.error(`Board server was not Google Drive`);
      unlockButton();
      return;
    }

    const outputs = await inlineAllContent(
      boardServer.dataPartTransformer(),
      this.#appPresenter.finalOutput!,
      currentGraphUrl
    );
    if (!ok(outputs)) {
      console.error(`Unable to inline content`, outputs);
      unlockButton();
      return;
    }

    const saving = await saveOutputsAsFile(outputs);
    if (!ok(saving)) {
      console.error(`Unable to save`, saving.$error);
      unlockButton();
      return;
    }

    const url = URL.createObjectURL(saving);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.graph?.title || "outputs"}-saved.${extensionFromMimeType(saving.type)}`;
    document.body.appendChild(a);
    a.click();

    a.remove();
    URL.revokeObjectURL(url);

    unlockButton();

    this.sca.services.actionTracker?.shareResults("download");

    function lockButton() {
      btn!.disabled = true;
    }

    function unlockButton() {
      btn!.disabled = false;
    }
  }

  async #onClickSaveResults() {
    const snackbarId = globalThis.crypto.randomUUID();
    this.dispatchEvent(
      new SnackbarEvent(
        snackbarId,
        `Saving results to your Google Drive...`,
        SnackType.PENDING,
        [],
        true,
        true
      )
    );

    const unsnackbar = () => {
      this.dispatchEvent(new UnsnackbarEvent());
    };

    const btn = this.#shareResultsButton.value;
    if (!btn) {
      console.error("No share results button");
      unsnackbar();
      return;
    }
    this.resultsUrl = null;

    const lockButton = () => {
      btn.disabled = true;
    };
    const unlockButton = () => {
      btn.disabled = false;
    };

    lockButton();

    // Check if we're published. We can only share results for published graphs.
    if (!this.sca.services.googleDriveClient) {
      console.error(`No google drive client`);
      unlockButton();
      unsnackbar();
      return;
    }

    const currentGraphUrl = this.graph?.url;
    if (!currentGraphUrl) {
      console.error(`No graph url`);
      unlockButton();
      unsnackbar();
      return;
    }
    const currentGraphFileId = extractGoogleDriveFileId(currentGraphUrl);
    if (!currentGraphFileId) {
      console.error(`Graph URL is not drive:`, currentGraphUrl);
      unlockButton();
      unsnackbar();
      return;
    }

    let shareableGraphFileId;
    const currentGraphMetadata =
      await this.sca.services.googleDriveClient.getFileMetadata(
        currentGraphFileId,
        { fields: ["properties", "capabilities"] }
      );
    const isShareableCopy =
      !!currentGraphMetadata.properties?.[
        DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN
      ];
    if (isShareableCopy) {
      // The user is already consuming the shareable copy, so just use that for
      // the results link.
      shareableGraphFileId = currentGraphFileId;
    } else {
      const linkedShareableCopyFileId =
        currentGraphMetadata.properties?.[
          DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY
        ];
      if (linkedShareableCopyFileId) {
        // The user is consuming the editable version, but it is shared, and we
        // know the file id of the shareable version. Automatically substitute
        // it in.
        shareableGraphFileId = linkedShareableCopyFileId;
      } else if (currentGraphMetadata.capabilities.canShare) {
        // This graph isn't shared at all, but the current user could share it
        // if they wanted to. Tell them to.
        this.dispatchEvent(
          new SnackbarEvent(
            snackbarId,
            `Please share your ${Strings.from("APP_NAME")} first`,
            SnackType.ERROR,
            [
              {
                title: "Share",
                action: "callback",
                callback: () => {
                  this.dispatchEvent(new ShareRequestedEvent());
                },
              },
            ],
            true,
            true
          )
        );
        unlockButton();
        return;
      } else {
        // An unusual case, but can happen when looking at older graphs.
        //
        // This is an unshared graph because it has neither of the Drive file
        // metadata properties we expect all shared graphs to have. Normally
        // this would happen when the owner of a graph is editing it and simply
        // hasn't shared yet. However, since we also don't have the canShare
        // capability, we know the current user isn't an owner or editor.
        //
        // The only way this could happen is if we're consuming a graph that
        // last was shared with the older pre-launch sharing model that only
        // used a single Drive file (before June 2025).
        //
        // Happily, can simply use the current file ID here, because if the
        // current user can consume this older-style graph, then whoever they
        // want to share their results with probably can too!
        shareableGraphFileId = currentGraphFileId;
      }
    }
    const shareableGraphResourceKeyPromise = this.sca.services.googleDriveClient
      .getFileMetadata(shareableGraphFileId, { fields: ["resourceKey"] })
      .then(({ resourceKey }) => resourceKey);

    if (!this.#appPresenter.finalOutput) {
      unlockButton();
      unsnackbar();
      return;
    }
    const boardServer = this.sca.services.googleDriveBoardServer;
    if (!boardServer) {
      console.error(`No board server`);
      unlockButton();
      unsnackbar();
      return;
    }
    if (!(boardServer instanceof GoogleDriveBoardServer)) {
      console.error(`Board server was not Google Drive`);
      unlockButton();
      unsnackbar();
      return;
    }

    const shareableGraphUrl = `drive:/${shareableGraphFileId}`;
    const finalOutputValues = await inlineAllContent(
      boardServer.dataPartTransformer(),
      this.#appPresenter.finalOutput!,
      shareableGraphUrl
    );
    if (!ok(finalOutputValues)) {
      unlockButton();
      this.dispatchEvent(
        new SnackbarEvent(
          snackbarId,
          `Error packaging results prior to saving`,
          SnackType.ERROR,
          [],
          true,
          true
        )
      );
      return;
    }

    this.dispatchEvent(
      new SnackbarEvent(
        snackbarId,
        `Saving results to your Google Drive...`,
        SnackType.PENDING,
        [],
        true,
        true
      )
    );
    let resultsFileId: string;
    try {
      const result = await boardServer.ops.writeRunResults({
        graphUrl: shareableGraphUrl,
        finalOutputValues,
      });
      resultsFileId = result.id;
    } catch (error) {
      console.log(error);
      this.dispatchEvent(
        new SnackbarEvent(
          snackbarId,
          `Error saving results to your Google Drive`,
          SnackType.ERROR,
          [],
          true,
          true
        )
      );
      unlockButton();
      return;
    }

    this.dispatchEvent(
      new SnackbarEvent(
        snackbarId,
        `Publishing results...`,
        SnackType.PENDING,
        [],
        true,
        true
      )
    );
    try {
      await boardServer.ops.publishFile(resultsFileId);
    } catch (error) {
      console.log(error);
      this.dispatchEvent(
        new SnackbarEvent(
          snackbarId,
          `Error publishing results from your Google Drive`,
          SnackType.ERROR,
          [],
          true,
          true
        )
      );
      unlockButton();
      return;
    }

    this.resultsUrl = makeUrl(
      {
        page: "graph",
        mode: "app",
        flow: shareableGraphUrl,
        resourceKey: await shareableGraphResourceKeyPromise,
        results: resultsFileId,
        guestPrefixed: false,
      },
      this.sca.services.globalConfig?.hostOrigin
    );

    this.sca.services.actionTracker?.shareResults("save_to_drive");

    unlockButton();

    this.dispatchEvent(new UnsnackbarEvent());
  }

  #renderInput() {
    const input = this.sca.controller.run.main.input;
    if (!input) {
      this.style.setProperty("--input-clearance", `0px`);

      return nothing;
    }

    const PADDING = 24;
    return html`<bb-floating-input
      .schema=${input.schema}
      .focusWhenIn=${this.focusWhenIn}
      .disclaimerContent=${this.disclaimerContent}
      @bbresize=${(evt: ResizeEvent) => {
        this.style.setProperty(
          "--input-clearance",
          `${evt.contentRect.height + PADDING}px`
        );
      }}
    ></bb-floating-input>`;
  }

  protected willUpdate(_changedProperties: PropertyValues): void {
    if (this.sca.controller.run.main.status === "running" && this.resultsUrl) {
      this.resultsUrl = null;
    }
  }

  render() {
    const classes: Record<string, boolean> = {
      "app-template": true,
      [this.options.mode]: true,
    };

    if (this.options.additionalOptions) {
      for (const [name, value] of Object.entries(
        this.options.additionalOptions
      )) {
        classes[`${name}-${value}`] = true;
      }
    }

    const retrievingSplash =
      (typeof this.options.splashImage === "boolean" &&
        this.options.splashImage) ||
      (this.isFreshGraph && this.isRefreshingAppTheme);

    let styles: Record<string, string> = {};
    if (this.options.theme) {
      styles = this.isEmpty
        ? emptyStyles
        : Theme.createThemeStyles(this.options.theme, Theme.appColorMapping);
    }

    // Special-case the default theme based on the mime types.
    // TODO: Replace this with a more robust check.
    if (this.options.isDefaultTheme) {
      if (!retrievingSplash) {
        styles["--splash-width"] = "50%";
      }
      styles["--splash-fill"] = "contain";
      styles["--start-border"] = "var(--secondary-color)";
      styles["--default-progress"] = "url(/images/progress-inverted.svg)";
      styles["--start-icon"] = "var(--bb-icon-generative-inverted)";
      styles["--input-background"] =
        "oklch(from var(--s-80) calc(l + 0.2) c h)";
    }
    if (typeof this.options.splashImage === "string") {
      styles["--splash-image"] = this.options.splashImage;
    }

    if (!this.options.title) {
      if (this.sca.controller.run.main.status === "stopped") {
        return html`<section
          class=${classMap(classes)}
          style=${styleMap(styles)}
        >
          <div id="content">
            <div class="loading"><p class="loading-message">Loading...</p></div>
          </div>
        </section>`;
      }
    }

    const editable = !this.readOnly && !this.isFreshGraph;
    const splashScreen = html`
      <div
        id="splash"
        class=${classMap({
          "retrieving-splash": retrievingSplash,
          default: !retrievingSplash && (this.options.isDefaultTheme ?? false),
        })}
        @animationend=${() => {
          this.hasRenderedSplash = true;
        }}
      >
        <section id="splash-content-container">
          <h1
            ?contenteditable=${editable}
            class=${classMap({
              "w-500": true,
              round: true,
              "sans-flex": true,
              "md-display-small": true,
              invisible: this.isFreshGraph,
            })}
            @blur=${(evt: Event) => {
              if (this.readOnly) {
                return;
              }

              if (
                !(evt.target instanceof HTMLElement) ||
                !evt.target.textContent
              ) {
                return;
              }
              const newTitle = evt.target.textContent.trim();
              if (newTitle === this.options.title) {
                return;
              }
              this.dispatchEvent(
                new StateEvent({
                  eventType: "board.rename",
                  title: newTitle,
                  description: null,
                })
              );
            }}
            .innerText=${this.isFreshGraph ? "..." : this.options.title}
          ></h1>
          <p
            ?contenteditable=${editable}
            class=${classMap({
              "w-500": true,
              round: true,
              "sans-flex": true,
              "md-title-medium": true,
              invisible: this.isFreshGraph,
            })}
            @blur=${(evt: Event) => {
              if (this.readOnly) {
                return;
              }

              if (this.readOnly) {
                return;
              }

              if (
                !(evt.target instanceof HTMLElement) ||
                !evt.target.textContent
              ) {
                return;
              }

              const newDescription = evt.target.textContent.trim();
              if (newDescription === this.options.description) {
                return;
              }

              this.dispatchEvent(
                new StateEvent({
                  eventType: "board.rename",
                  title: null,
                  description: newDescription,
                })
              );
            }}
            .innerText=${this.isFreshGraph
              ? "..."
              : (this.options.description ?? "")}
          ></p>
          <div id="input" class="stopped">
            <div id="run-container">
              <button
                id="run"
                class=${classMap({ invisible: this.isFreshGraph })}
                @click=${() => {
                  this.sca.services.actionTracker?.runApp(
                    this.graph?.url,
                    "app_preview"
                  );
                  this.dispatchEvent(
                    new StateEvent({ eventType: "board.run" })
                  );
                }}
              >
                <span class="g-icon filled heavy round"></span>${this
                  .isRefreshingAppTheme
                  ? "Updating..."
                  : "Start"}
              </button>
              ${!this.isFreshGraph
                ? html`<bb-onboarding-tooltip
                    .onboardingId=${"first-run"}
                    style=${styleMap({
                      "--top": `-24px`,
                      "--right": "0px",
                    })}
                    .stackTop=${true}
                  ></bb-onboarding-tooltip>`
                : nothing}
            </div>
          </div>
        </section>
      </div>
    `;

    const shouldRenderProgress =
      this.#appPresenter.state === "progress" &&
      this.sca.controller.global.consent.pendingInApp.length === 0;
    let content: Array<HTMLTemplateResult | symbol> = [];
    if (this.isEmpty) {
      content = [this.#renderEmptyState()];
    } else {
      if (this.sca.controller.global.consent.pendingInApp.length > 0) {
        content = [this.#renderConsent()];
      } else {
        switch (this.#appPresenter.state) {
          case "splash":
            content = [splashScreen];
            break;

          case "progress":
            // Progress is always rendered but hidden (so as to avoid re-renders),
            // so this becomes a no-op here to ensure we cover all states.
            // The only thing we need to do is clean up after input
            this.style.setProperty("--input-clearance", `0px`);
            break;

          case "input":
            content = [this.#renderOutputs(), this.#renderInput()];
            break;

          case "output":
            if (this.graph && this.sca.services.googleDriveBoardServer) {
              void maybeTriggerNlToOpalSatisfactionSurvey(
                this.#appPresenter,
                this.sca.controller.editor.graph,
                this.graph,
                this.sca.services.googleDriveBoardServer
              );
            }
            content = [this.#renderOutputs(), this.#renderSaveResultsButtons()];
            break;

          case "error":
            content = [this.#renderError()];
            break;

          case "interactive":
            content = [this.#renderOutputs()];
            break;

          default: {
            console.warn(
              "Unknown state",
              this.#appPresenter.state,
              "rendering splash screen"
            );
            content = [splashScreen];
          }
        }
      }
    }

    return html`<section class=${classMap(classes)} style=${styleMap(styles)}>
      <div id="content">
        ${this.#renderControls()} ${this.#renderProgress(shouldRenderProgress)}
        ${content}
      </div>
    </section>`;
  }
}
