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
  SnackType,
} from "../../types/types";

import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import * as Theme from "@breadboard-ai/theme";
import {
  BoardServer,
  GraphDescriptor,
  isInlineData,
  isLLMContentArray,
  ok,
} from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";
import { consume, provide } from "@lit/context";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { boardServerContext } from "../../contexts/board-server.js";
import { projectRunContext } from "../../contexts/project-run.js";
import {
  ResizeEvent,
  ShareRequestedEvent,
  SnackbarEvent,
  StateEvent,
  UnsnackbarEvent,
} from "../../events/events";
import { ProjectRun } from "../../state/types.js";
import { emptyStyles } from "../../styles/host/colors-empty.js";
import { ActionTracker } from "../../utils/action-tracker.js";
import { appScreenToParticles } from "../shared/utils/app-screen-to-particles.js";
import { styles as appStyles } from "./index.styles.js";
import { theme as uiTheme } from "./theme/light.js";
import { v0_8 } from "@breadboard-ai/a2ui";
import * as A2UI from "@breadboard-ai/a2ui/ui";
import { theme as a2uiTheme } from "../../a2ui-theme/a2ui-theme.js";

import "./header/header.js";

import {
  extensionFromMimeType,
  inlineAllContent,
  saveOutputsAsFile,
} from "@breadboard-ai/data";
import {
  MAIN_TO_SHAREABLE_COPY_PROPERTY,
  SHAREABLE_COPY_TO_MAIN_PROPERTY,
} from "@breadboard-ai/google-drive-kit/board-server/operations.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import * as ParticlesUI from "@breadboard-ai/particles-ui";
import { createRef, ref } from "lit/directives/ref.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { markdown } from "../../directives/markdown.js";
import { makeUrl } from "../../utils/urls.js";

import {
  AppScreenOutput,
  RuntimeFlags,
  ConsentAction,
  ConsentType,
  ConsentUIType,
} from "@breadboard-ai/types";
import { maybeTriggerNlToOpalSatisfactionSurvey } from "../../survey/nl-to-opal-satisfaction-survey.js";
import { repeat } from "lit/directives/repeat.js";
import { consentManagerContext } from "../../contexts/consent-manager.js";
import {
  ConsentManager,
  CONSENT_RENDER_INFO,
} from "../../utils/consent-manager.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const toFunctionString = (fn: Function, bindings?: Record<string, unknown>) => {
  let str = fn.toString();
  if (bindings) {
    for (const [key, value] of Object.entries(bindings)) {
      str = str.replace(key, `(${JSON.stringify(value)})`);
    }
  }
  return str;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const scriptifyFunction = (fn: Function, bindings?: Record<string, unknown>) =>
  `<script>( ${toFunctionString(fn, bindings)} )();</script>`;

// Will be bound into the iframe script as the targetOrigin for postMessage
const PARENT_ORIGIN = window.location.origin;

// This script will be run in the AppCat-generated iframe, and will intercept
// any popups that are opened by the app to post back to Opal to request
// opening after gaining consent. The iframe is sandboxed and does not allow
// popups itself, so this is a best-effort to
const interceptPopupsScript = scriptifyFunction(
  () => {
    const requestPopup = (url: URL) =>
      window.parent.postMessage(
        {
          type: "request-open-popup",
          url: url.toString(),
        },
        PARENT_ORIGIN
      );
    // This script is guaranteed to be run before any generated scripts, and
    // we don't let the generated HTML override this
    Object.defineProperty(window, "open", {
      value: function (url?: string | URL) {
        if (url) {
          requestPopup(new URL(url));
        }
        return undefined;
      },
      writable: false,
      configurable: false,
      enumerable: false,
    });
    const findAncestorTag = <T extends keyof HTMLElementTagNameMap>(
      event: Event,
      tag: T
    ) => {
      const path = event.composedPath();
      return path.find((el) => (el as HTMLElement).localName === tag) as
        | HTMLElementTagNameMap[typeof tag]
        | undefined;
    };
    // This listener is capturing and guaranteed to be run before any
    // generated scripts, so we always get first crack at intercepting popups
    window.addEventListener(
      "click",
      (evt) => {
        const anchor = findAncestorTag(evt, "a");
        if (anchor) {
          requestPopup(new URL(anchor.href));
          evt.preventDefault();
          evt.stopImmediatePropagation();
        }
      },
      true
    );
  },
  {
    PARENT_ORIGIN,
  }
);

function isHTMLOutput(screen: AppScreenOutput): string | null {
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

@customElement("app-basic")
export class Template extends SignalWatcher(LitElement) implements AppTemplate {
  @property({ type: Object })
  accessor options: AppTemplateOptions = {
    title: "Untitled App",
    mode: "light",
    splashImage: false,
  };

  @provide({ context: ParticlesUI.Context.themeContext })
  accessor theme: ParticlesUI.Types.UITheme = uiTheme;

  @provide({ context: A2UI.Context.themeContext })
  accessor a2uitheme: v0_8.Types.Theme = a2uiTheme;

  @state()
  @consume({ context: projectRunContext, subscribe: true })
  accessor run: ProjectRun | null = null;

  @state()
  @consume({ context: consentManagerContext })
  accessor consentManager: ConsentManager | undefined = undefined;

  @property()
  accessor focusWhenIn: FloatingInputFocusState = ["app"];

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor runtimeFlags: RuntimeFlags | null = null;

  @property()
  accessor showGDrive = false;

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

  @consume({ context: boardServerContext, subscribe: true })
  accessor boardServer: BoardServer | undefined;

  @state()
  accessor showAddAssetModal = false;

  @state()
  accessor resultsUrl: string | null = null;

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient | undefined;

  @query("#export-output-button")
  accessor exportOutputsButton: HTMLButtonElement | null = null;

  readonly #shareResultsButton = createRef<HTMLButtonElement>();

  readonly outputHtmlIframeRef = createRef<HTMLIFrameElement>();
  #messageListenerController: AbortController | null = null;

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

  connectedCallback() {
    super.connectedCallback();
    if (this.runtimeFlags?.requireConsentForOpenWebpage) {
      window.addEventListener(
        "message",
        async (event: MessageEvent<{ type: string; url: string }>) => {
          if (
            event.source === this.outputHtmlIframeRef.value?.contentWindow &&
            event.data.type === "request-open-popup"
          ) {
            const url = new URL(event.data.url);
            const graphUrl = this.graph?.url;
            if (this.consentManager && graphUrl) {
              const allow = await this.consentManager.queryConsent(
                {
                  graphUrl,
                  type: ConsentType.OPEN_WEBPAGE,
                  scope: url.origin,
                },
                ConsentUIType.MODAL
              );
              if (!allow) {
                return;
              }
            }
            window.open(url.toString(), "_blank");
          }
        },
        { signal: this.#messageListenerController?.signal }
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#messageListenerController?.abort();
  }

  #renderControls() {
    return html`<bb-app-header
      .isEmpty=${this.isEmpty}
      .progress=${this.run?.progress}
      .replayActive=${this.headerConfig.replay}
      .menuActive=${this.headerConfig.menu}
      .fullScreenActive=${this.headerConfig.fullscreen}
      .small=${this.headerConfig.small}
      .appTitle=${this.graph?.title}
      @bbevent=${(evt: StateEvent<"board.stop">) => {
        if (evt.detail.eventType !== "board.stop") {
          return;
        }
      }}
    ></bb-app-header>`;
  }

  #renderOutputs() {
    if (!this.run) return nothing;

    let activityContents:
      | HTMLTemplateResult
      | Array<HTMLTemplateResult | symbol>
      | symbol = nothing;
    const last = this.run.app.last?.last;
    if (last) {
      const htmlOutput = isHTMLOutput(last);
      if (htmlOutput !== null) {
        activityContents = html`<iframe
          srcdoc=${interceptPopupsScript + htmlOutput}
          ${ref(this.outputHtmlIframeRef)}
          frameborder="0"
          class="html-view"
          sandbox="allow-scripts allow-forms"
        ></iframe>`;
      } else if (
        isLLMContentArray(last.output.context) &&
        isInlineData(last.output.context[0]?.parts[0]) &&
        last.output.context[0].parts[0].inlineData.mimeType === "text/a2ui"
      ) {
        const a2UI = last.output.context[0].parts[0];
        try {
          const binaryString = atob(a2UI.inlineData.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const decoder = new TextDecoder("utf-8");
          const rawData = decoder.decode(bytes);
          const data = JSON.parse(rawData);
          let messages = data[0].parts[0].json;
          if (!Array.isArray(messages)) {
            messages = [messages];
          }

          const processor = new v0_8.Data.A2UIModelProcessor();
          processor.clearSurfaces();
          processor.processMessages(messages);

          activityContents = html`<section id="surfaces">
            ${repeat(
              processor.getSurfaces(),
              ([surfaceId]) => surfaceId,
              ([surfaceId, surface]) => {
                return html`<a2ui-surface
                    .surfaceId=${surfaceId}
                    .surface=${surface}
                    .processor=${processor}
                  ></a2-uisurface>`;
              }
            )}
          </section>`;
        } catch (err) {
          console.warn(err);
          activityContents = html`Unable to parse response`;
        }
      } else if (last.a2ui) {
        const { processor, receiver } = last.a2ui;
        activityContents = html`<section id="surfaces">
          <bb-a2ui-client-view .processor=${processor} .receiver=${receiver}>
          </bb-a2ui-client-view>
        </section>`;
      } else {
        // Convert app screen to particles. There's a belt-and-braces check
        // afterwards to ensure that the top-level list has a valid
        // presentation because by default a Particle doesn't have one but we
        // still need it at this point.
        // TODO: Remove this conversion when ProjectRun.app emits particles
        const group = appScreenToParticles(last);
        if (typeof group?.presentation === "string") {
          group.presentation = {
            behaviors: [],
            orientation: "vertical",
            type: "list",
          };
        }

        activityContents = html` <particle-ui-list
          class=${classMap(this.theme.groups.list)}
          .group=${group}
          .orientation=${group?.presentation?.orientation}
        ></particle-ui-list>`;
      }
    }

    return html`<div id="activity">${[activityContents]}</div>`;
  }
  #renderProgress(active: boolean) {
    if (!this.run) return nothing;

    const titles = Array.from(this.run.app.current.values()).map((screen) => {
      if (!screen.progress) return screen.title;
      if (screen.progressCompletion < 0) return screen.progress;
      return `${screen.progress}: ${screen.progressCompletion}%`;
    });

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
    if (!this.run) return nothing;
    const error = this.run.error;
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
    const consentRequest = this.run?.app.consentRequests[0];
    if (!consentRequest) {
      return nothing;
    }
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
              consentRequest.consentCallback(ConsentAction.ALWAYS_ALLOW);
              // This is gross, but allows the next screen to render so we don't
              // jank back to the starting screen for a split second
              setTimeout(() => {
                this.run?.app.consentRequests.shift();
              });
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
    if (!this.run?.finalOutput) {
      return nothing;
    }

    this.style.setProperty("--input-clearance", `0px`);

    return html`
      <div id="save-results-button-container">
        ${this.resultsUrl
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
              class="sans-flex w-500 round md-body-medium"
              @click=${this.#onClickSaveResults}
              ${ref(this.#shareResultsButton)}
            >
              <span class="g-icon filled round">share</span>
              Share output
            </button>`}
        <button
          id="export-output-button"
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

    ActionTracker.shareResults("copy_share_link");

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

    if (!this.run) {
      console.error(`No project run`);
      unlockButton();
      return;
    }

    const currentGraphUrl = this.graph?.url;
    if (!currentGraphUrl) {
      console.error(`No graph url`);
      unlockButton();
      return;
    }

    if (!this.run.finalOutput) {
      unlockButton();
      return;
    }

    const boardServer = this.boardServer as GoogleDriveBoardServer;
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
      this.run.finalOutput,
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

    ActionTracker.shareResults("download");

    function lockButton() {
      btn!.disabled = true;
    }

    function unlockButton() {
      btn!.disabled = false;
    }
  }

  async #onClickSaveResults() {
    const btn = this.#shareResultsButton.value;
    if (!btn) {
      console.error("No share results button");
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

    if (!this.run) {
      console.error(`No project run`);
      unlockButton();
      return;
    }

    // Check if we're published. We can only share results for published graphs.
    if (!this.googleDriveClient) {
      console.error(`No google drive client`);
      unlockButton();
      return;
    }

    const currentGraphUrl = this.graph?.url;
    if (!currentGraphUrl) {
      console.error(`No graph url`);
      unlockButton();
      return;
    }
    const currentGraphFileId = extractGoogleDriveFileId(currentGraphUrl);
    if (!currentGraphFileId) {
      console.error(`Graph URL is not drive:`, currentGraphUrl);
      unlockButton();
      return;
    }

    let shareableGraphFileId;
    const currentGraphMetadata = await this.googleDriveClient.getFileMetadata(
      currentGraphFileId,
      { fields: ["properties", "capabilities"] }
    );
    const isShareableCopy =
      !!currentGraphMetadata.properties?.[SHAREABLE_COPY_TO_MAIN_PROPERTY];
    if (isShareableCopy) {
      // The user is already consuming the shareable copy, so just use that for
      // the results link.
      shareableGraphFileId = currentGraphFileId;
    } else {
      const linkedShareableCopyFileId =
        currentGraphMetadata.properties?.[MAIN_TO_SHAREABLE_COPY_PROPERTY];
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
            crypto.randomUUID(),
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
    const shareableGraphResourceKeyPromise = this.googleDriveClient
      .getFileMetadata(shareableGraphFileId, { fields: ["resourceKey"] })
      .then(({ resourceKey }) => resourceKey);

    if (!this.run.finalOutput) {
      unlockButton();
      return;
    }
    const boardServer = this.boardServer;
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

    const shareableGraphUrl = `drive:/${shareableGraphFileId}`;
    const finalOutputValues = await inlineAllContent(
      boardServer.dataPartTransformer(),
      this.run.finalOutput,
      shareableGraphUrl
    );
    if (!ok(finalOutputValues)) {
      unlockButton();
      this.dispatchEvent(
        new SnackbarEvent(
          globalThis.crypto.randomUUID(),
          `Error packaging results prior to saving`,
          SnackType.ERROR,
          [],
          true,
          true
        )
      );
      return;
    }

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

    this.resultsUrl = makeUrl({
      page: "graph",
      mode: "app",
      flow: shareableGraphUrl,
      resourceKey: await shareableGraphResourceKeyPromise,
      results: resultsFileId,
      shared: true,
    });

    ActionTracker.shareResults("save_to_drive");

    unlockButton();

    this.dispatchEvent(new UnsnackbarEvent());
  }

  #renderInput() {
    const input = this.run?.input;
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
    if (this.run?.status === "running" && this.resultsUrl) {
      this.resultsUrl = null;
    }
  }

  render() {
    const classes: Record<string, boolean> = {
      "app-template": true,
      [this.options.mode]: true,
    };

    if (!this.run) {
      return nothing;
    }

    if (this.options.additionalOptions) {
      for (const [name, value] of Object.entries(
        this.options.additionalOptions
      )) {
        classes[`${name}-${value}`] = true;
      }
    }

    let styles: Record<string, string> = {};
    if (this.options.theme) {
      styles = this.isEmpty
        ? emptyStyles
        : Theme.createThemeStyles(this.options.theme, Theme.appColorMapping);
    }

    // Special-case the default theme based on the mime types.
    // TODO: Replace this with a more robust check.
    if (this.options.isDefaultTheme) {
      styles["--splash-width"] = "50%";
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
      if (!this.run || this.run.status === "stopped") {
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

    const retrievingSplash =
      typeof this.options.splashImage === "boolean" && this.options.splashImage;
    const splashScreen = html`
      <div
        id="splash"
        class=${classMap({
          "retrieving-splash": retrievingSplash,
          default: this.options.isDefaultTheme ?? false,
        })}
        @animationend=${() => {
          this.hasRenderedSplash = true;
        }}
      >
        <section id="splash-content-container">
          <h1
            class="w-500 round sans-flex md-display-small"
            ?contenteditable=${!this.readOnly}
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
            .innerText=${this.options.title}
          ></h1>
          <p
            ?contenteditable=${!this.readOnly}
            class="w-500 round sans-flex md-title-medium"
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
            .innerText=${this.options.description ?? ""}
          ></p>
          <div id="input" class="stopped">
            <div>
              <button
                id="run"
                @click=${() => {
                  ActionTracker.runApp(this.graph?.url, "app_preview");
                  this.dispatchEvent(
                    new StateEvent({ eventType: "board.run" })
                  );
                }}
              >
                <span class="g-icon"></span>Start
              </button>
            </div>
          </div>
        </section>
      </div>
    `;

    let content: Array<HTMLTemplateResult | symbol> = [];
    if (this.isEmpty) {
      content = [this.#renderEmptyState()];
    } else {
      switch (this.run.app.state) {
        case "splash":
          content = [splashScreen];
          break;

        case "progress":
          // Progress is always rendered but hidden (so as to avoid re-renders),
          // so this becomes a no-op here to ensure we cover all states.
          break;

        case "input":
          content = [this.#renderOutputs(), this.#renderInput()];
          break;

        case "output":
          if (this.graph && this.boardServer) {
            void maybeTriggerNlToOpalSatisfactionSurvey(
              this.run,
              this.graph,
              this.boardServer
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

        case "consent":
          content = [this.#renderConsent()];
          break;

        default: {
          console.warn(
            "Unknown state",
            this.run.app.state,
            "rendering splash screen"
          );
          content = [splashScreen];
        }
      }
    }

    return html`<section class=${classMap(classes)} style=${styleMap(styles)}>
      <div id="content">
        ${this.#renderControls()}
        ${this.#renderProgress(this.run.app.state === "progress")} ${content}
      </div>
    </section>`;
  }
}
