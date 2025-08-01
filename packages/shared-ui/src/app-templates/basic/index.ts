/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import {
  LitElement,
  html,
  nothing,
  HTMLTemplateResult,
  PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  AppTemplate,
  AppTemplateOptions,
  FloatingInputFocusState,
  SnackbarUUID,
  SnackType,
} from "../../types/types";

import { classMap } from "lit/directives/class-map.js";
import {
  asBase64,
  BoardServer,
  GraphDescriptor,
  isInlineData,
  isLLMContentArray,
  ok,
  transformDataParts,
} from "@google-labs/breadboard";
import { styleMap } from "lit/directives/style-map.js";
import {
  ResizeEvent,
  ShareRequestedEvent,
  SignInRequestedEvent,
  SnackbarEvent,
  StateEvent,
  UnsnackbarEvent,
} from "../../events/events";
import { SigninAdapterState } from "../../utils/signin-adapter";
import { createThemeStyles } from "@breadboard-ai/theme";
import { ActionTracker } from "../../utils/action-tracker.js";
import { consume, provide } from "@lit/context";
import { boardServerContext } from "../../contexts/board-server.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { NodeValue } from "@breadboard-ai/types";
import { projectRunContext } from "../../contexts/project-run.js";
import { AppScreenOutput, ProjectRun } from "../../state/types.js";
import { SignalWatcher } from "@lit-labs/signals";
import { theme as uiTheme } from "./theme/light.js";
import { appScreenToParticles } from "../shared/utils/app-screen-to-particles.js";
import { emptyStyles } from "../../styles/host/colors-empty.js";
import { styles as appStyles } from "./index.styles.js";

import "./header/header.js";

import * as ParticlesUI from "@breadboard-ai/particles-ui";
import { escapeStr } from "../../utils/escape-str.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import {
  MAIN_TO_SHAREABLE_COPY_PROPERTY,
  SHAREABLE_COPY_TO_MAIN_PROPERTY,
} from "@breadboard-ai/google-drive-kit/board-server/operations.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/google-drive-kit/board-server/utils.js";
import { ref, createRef } from "lit/directives/ref.js";

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

  @state()
  @consume({ context: projectRunContext, subscribe: true })
  accessor run: ProjectRun | null = null;

  @property()
  accessor focusWhenIn: FloatingInputFocusState = ["app"];

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor showGDrive = false;

  @property()
  accessor isEmpty = false;

  @property()
  accessor disclaimerContent = "";

  @property()
  accessor state: SigninAdapterState["status"] = "anonymous";

  @property({ reflect: true, type: Boolean })
  accessor hasRenderedSplash = false;

  @property({ reflect: true, type: Boolean })
  accessor showShareButton = true;

  @property()
  accessor readOnly = true;

  @consume({ context: boardServerContext, subscribe: true })
  accessor boardServer: BoardServer | undefined;

  @state()
  accessor showAddAssetModal = false;

  @state()
  accessor resultsUrl: string | null = null;

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient | undefined;

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

  #notifiedErrors = new Set<string>();
  #clearNotifiedErrors() {
    for (const errorId of this.#notifiedErrors) {
      this.dispatchEvent(new UnsnackbarEvent(errorId as SnackbarUUID));
    }

    this.#notifiedErrors.clear();
  }

  #renderControls() {
    return html`<bb-app-header
      .isEmpty=${this.isEmpty}
      .progress=${this.run?.progress}
      .replayActive=${true}
      .menuActive=${true}
      .appTitle=${this.graph?.title}
      @bbevent=${(evt: StateEvent<"board.stop">) => {
        if (evt.detail.eventType !== "board.stop") {
          return;
        }

        this.#clearNotifiedErrors();
      }}
    ></bb-app-header>`;
  }

  #renderActivity() {
    if (!this.run) return nothing;

    let activityContents:
      | HTMLTemplateResult
      | Array<HTMLTemplateResult | symbol>
      | symbol = nothing;
    let status: HTMLTemplateResult | symbol = nothing;

    const errors = this.run.errors;
    if (this.#notifiedErrors.size > errors.size) {
      this.#clearNotifiedErrors();
    }

    if (errors.size > 0) {
      for (const [errorId, error] of errors) {
        if (this.#notifiedErrors.has(errorId)) {
          continue;
        }

        this.#notifiedErrors.add(errorId);
        this.dispatchEvent(
          new SnackbarEvent(
            errorId as SnackbarUUID,
            error.message,
            SnackType.ERROR,
            [],
            true,
            true
          )
        );
      }

      activityContents = html`
        ${Array.from(errors.values()).map(() => {
          return html`<section class="error">
            <h1 class="w-700 sans-flex round md-headline-large">
              Oops, something went wrong
            </h1>
          </section>`;
        })}
      `;
    } else {
      const current = this.run.app.current;
      if (!current) return nothing;

      if (this.run.status === "running") {
        status = html`<div id="status">
          <span class="g-icon"></span>
          ${this.run.app.current?.title}
        </div>`;
      }

      if (current.last) {
        const htmlOutput = isHTMLOutput(current.last);
        if (htmlOutput !== null) {
          activityContents = html`<iframe
            srcdoc=${htmlOutput}
            frameborder="0"
            class="html-view"
            sandbox="allow-scripts allow-forms"
          ></iframe>`;
        } else {
          // Convert app screen to particles. There's a belt-and-braces check
          // afterwards to ensure that the top-level list has a valid
          // presentation because by default a Particle doesn't have one but we
          // still need it at this point.
          // TODO: Remove this conversion when ProjectRun.app emits particles
          const group = appScreenToParticles(current.last);
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
    }

    return html`<div id="activity">${[activityContents, status]}</div>`;
  }

  #renderEmptyState() {
    return html`<div id="activity">
      <p class="sans-flex round filled md-title-medium empty-state">
        ${Strings.from("LABEL_EMPTY")}
      </p>
    </div>`;
  }

  #renderSaveResultsButton() {
    if (!this.run?.finalOutput) {
      return nothing;
    }

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
      </div>
    `;
  }

  async #onClickCopyShareUrl(evt: Event) {
    if (!(evt.target instanceof HTMLButtonElement) || !this.resultsUrl) {
      return;
    }

    await navigator.clipboard.writeText(decodeURIComponent(this.resultsUrl));

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
    const metadata = await this.googleDriveClient.getFileMetadata(
      currentGraphFileId,
      { fields: ["properties"] }
    );
    const isPublishedCopy =
      metadata.properties?.[SHAREABLE_COPY_TO_MAIN_PROPERTY];
    if (isPublishedCopy) {
      shareableGraphFileId = currentGraphFileId;
    } else {
      const publishedCopyFileId =
        metadata.properties?.[MAIN_TO_SHAREABLE_COPY_PROPERTY];
      if (publishedCopyFileId) {
        shareableGraphFileId = publishedCopyFileId;
      } else {
        this.dispatchEvent(
          new SnackbarEvent(
            crypto.randomUUID(),
            `Please share your ${Strings.from("APP_NAME")} first`,
            SnackType.ERROR,
            [
              {
                title: "Share",
                action: "callback",
                callback: () => this.dispatchEvent(new ShareRequestedEvent()),
              },
            ],
            true,
            true
          )
        );
        unlockButton();
        return;
      }
    }
    const shareableGraphUrl = `drive:/${shareableGraphFileId}`;

    // Clone because we are going to inline content below.
    const finalOutputValues = structuredClone(this.run.finalOutput);
    if (!finalOutputValues) {
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

    // Inline all content.
    await Promise.all(
      Object.entries(finalOutputValues).map(async ([key, value]) => {
        if (!isLLMContentArray(value)) {
          return;
        }

        // Transform any inline data parts.
        const inlined = await transformDataParts(
          new URL(shareableGraphUrl),
          value,
          "inline",
          boardServer.dataPartTransformer(new URL(shareableGraphUrl))
        );
        if (!ok(inlined)) {
          console.error(`Error inlining results content for ${key}`, inlined);
          unlockButton();
          return;
        }

        // Also check for blobs inside of HTML, and inline those too.
        for (const content of inlined) {
          for (const part of content.parts) {
            if (
              "inlineData" in part &&
              part.inlineData.mimeType === "text/html" &&
              part.inlineData.data
            ) {
              const html = part.inlineData.data;
              part.inlineData.data = await inlineHtmlBlobUrls(html);
            }
          }
        }

        finalOutputValues[key] = inlined as NodeValue;
      })
    );

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

    const shareUrl = new URL(`/`, document.location.origin);
    shareUrl.searchParams.set("flow", shareableGraphUrl);
    shareUrl.searchParams.set("mode", "app");
    shareUrl.searchParams.set("results", resultsFileId);
    shareUrl.searchParams.set("shared", "true");

    this.resultsUrl = shareUrl.href;
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
        : createThemeStyles(this.options.theme);
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

    if (
      typeof this.options.splashImage === "boolean" &&
      this.options.splashImage
    ) {
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

    const splashScreen = html`
      <div
        id="splash"
        class=${classMap({ default: this.options.isDefaultTheme ?? false })}
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
            .innerHTML=${escapeStr(this.options.title)}
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
            .innerHTML=${escapeStr(this.options.description) ?? ""}
          ></p>
          <div id="input" class="stopped">
            <div>
              ${this.state === "anonymous" || this.state === "signedin"
                ? html`<button
                    id="run"
                    ?disabled=${!this.run.runnable}
                    @click=${() => {
                      ActionTracker.runApp(this.graph?.url, "app_preview");
                      this.dispatchEvent(
                        new StateEvent({ eventType: "board.run" })
                      );
                    }}
                  >
                    <span class="g-icon"></span>Start
                  </button>`
                : html`<button
                    id="sign-in"
                    ?disabled=${!this.run.runnable}
                    @click=${() => {
                      this.dispatchEvent(new SignInRequestedEvent());
                    }}
                  >
                    <span class="g-icon"></span>Sign In
                  </button>`}
            </div>
          </div>
        </section>
      </div>
    `;

    let content:
      | HTMLTemplateResult
      | Array<HTMLTemplateResult | symbol>
      | symbol = nothing;
    if (this.isEmpty) {
      content = [this.#renderControls(), this.#renderEmptyState()];
    } else if (this.run.app.state === "splash") {
      content = [this.#renderControls(), splashScreen];
    } else {
      content = [
        this.#renderControls(),
        this.#renderActivity(),
        this.#renderSaveResultsButton(),
        this.#renderInput(),
      ];
    }

    return html`<section class=${classMap(classes)} style=${styleMap(styles)}>
      <div id="content">${content}</div>
    </section>`;
  }
}

async function inlineHtmlBlobUrls(html: string): Promise<string> {
  const blobUrls = findBlobUrlsInHtml(html);
  if (blobUrls.length === 0) {
    return html;
  }

  const replacements = (
    await Promise.all(
      blobUrls.map(async ({ start, end, blobId }) => {
        // Let's not trust the raw URL. We instead extract the blob ID from the
        // URL if it looks like a blob URL, and then construct a new safe blob
        // URL from scratch. This way there is no way for generated HTML to
        // trigger an unsafe fetch.
        const safeUrl = new URL(
          `/board/blobs/${encodeURIComponent(blobId)}`,
          document.location.origin
        );
        const response = await fetch(safeUrl);
        if (!response.ok) {
          console.error(
            `${response.status} error fetching blob`,
            safeUrl,
            await response.text()
          );
          return null;
        }
        const blob = await response.blob();
        const base64 = await asBase64(blob);
        const dataUrl = `data:${blob.type};base64,${base64}`;
        return { start, end, replacement: dataUrl };
      })
    )
  ).filter((replacement) => replacement != null);

  // Apply replacements reverse so that indices remain correct.
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    html = html.slice(0, start) + replacement + html.slice(end);
  }
  return html;
}

function findBlobUrlsInHtml(
  str: string
): Array<{ start: number; end: number; blobId: string }> {
  const results = [];
  const matches = str.matchAll(/https?:\/\/[^/]+\/board\/blobs\/([a-z0-9-]+)/g);
  for (const match of matches) {
    results.push({
      start: match.index,
      end: match.index + match[0].length,
      blobId: match[1],
    });
  }
  return results;
}
