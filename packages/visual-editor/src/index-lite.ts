/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "./ui/index.js";
const Strings = BreadboardUI.Strings.forSection("Global");

import { html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MainArguments } from "./types/types.js";

import * as BBLite from "./ui/lite/lite.js";
import { MainBase } from "./main-base.js";
import { classMap } from "lit/directives/class-map.js";
import { StateEvent, StateEventDetailMap } from "./ui/events/events.js";
import { LiteEditInputController } from "./ui/lite/input/editor-input-lite.js";

import { reactive } from "./sca/reactive.js";

import { blankBoard } from "./ui/utils/blank-board.js";
import { repeat } from "lit/directives/repeat.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";

import { markdown } from "./ui/directives/markdown.js";
import { type SharePanel } from "./ui/elements/elements.js";
import { deriveLiteViewType } from "./sca/utils/lite-view-type.js";
import {
  CheckAppAccessResult,
  GuestConfiguration,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { extractGoogleDriveFileId } from "@breadboard-ai/utils/google-drive/utils.js";

@customElement("bb-lite")
export class LiteMain extends MainBase implements LiteEditInputController {
  @property()
  accessor showAppFullscreen = false;

  @property()
  accessor compactView = false;

  static styles = [
    BBLite.Styles.HostColorScheme.match,
    BBLite.Styles.HostIcons.icons,
    BBLite.Styles.HostBehavior.behavior,
    BBLite.Styles.HostColorsMaterial.baseColors,
    BBLite.Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: 1;
        background: var(--sys-color--body-background);

        --example-color: var(--sys-color--surface-container-low);
        --example-text-color: light-dark(#575b5f, #ffffff);
        --example-icon-background-color: light-dark(
          #d9d7fd,
          var(--sys-color--on-surface-low)
        );
        --example-icon-color: light-dark(#665ef6, #665ef6);
      }

      #loading,
      #error {
        display: flex;
        height: 100%;
        width: 100%;
        align-items: center;
        justify-content: center;
        color: var(--sys-color--on-surface);

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
          animation: rotate 1s linear infinite;
        }
      }

      #lite-shell {
        display: block;
        height: 100%;
        width: 100%;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-3) 0
          var(--bb-grid-size);

        & #controls {
          display: flex;
          flex-direction: column;
          gap: var(--bb-grid-size-2);
          padding-left: var(--bb-grid-size-2);
          padding-bottom: var(--bb-grid-size-3);

          & bb-prompt-view {
            flex: 0 0 auto;
            margin-bottom: var(--bb-grid-size-8);
          }

          & bb-step-list-view {
            flex: 1 1 auto;
            overflow: auto;
          }
        }

        & bb-editor-input-lite {
          flex: 0 0 auto;
          box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.16);
        }

        & #message {
          text-align: center;
          height: var(--bb-grid-size-7);
          margin: var(--bb-grid-size-2) 0;
          color: var(--sys-color--on-surface-variant);

          p {
            margin: 0;
          }

          a {
            color: var(--sys-color--on-surface);
          }

          &[disabled] {
            opacity: 0.3;
          }
        }

        & #app-view {
          position: relative;
          margin: 0 0 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-4);
          border: 1px solid var(--sys-color--surface-variant);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-bottom: var(--bb-grid-size-16);

          & bb-snackbar {
            width: calc(100% - var(--bb-grid-size-12));
            left: 50%;
            position: absolute;
          }

          & header {
            height: var(--bb-grid-size-16);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 var(--bb-grid-size-5);
            background: var(--sys-color--surface);
            color: var(--sys-color--on-surface);
            container-type: inline-size;

            & .left {
              flex: 1;
              gap: var(--bb-grid-size-2);
            }

            & .right {
              gap: var(--bb-grid-size-8);
            }

            & .left,
            & .right {
              display: flex;
              align-items: center;
              white-space: nowrap;
            }

            button,
            a {
              display: flex;
              align-items: center;
              color: var(--sys-color--on-surface);
              border: none;
              background: none;
              padding: 0;
              cursor: pointer;
              text-decoration: none;
              position: relative;

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }

              & bb-onboarding-tooltip {
                z-index: 300;
                white-space: normal;
                --top: calc(100% + var(--bb-grid-size-7) + 2px);
                --right: 0;
              }
            }

            & #experiment {
              display: none;
              font-size: 11px;
              line-height: 1;
              padding: var(--bb-grid-size) var(--bb-grid-size-3);
              border-radius: var(--bb-grid-size-16);
              border: 1px solid light-dark(var(--n-0), var(--n-70));
              text-transform: uppercase;
              color: light-dark(var(--n-0), var(--n-70));
            }

            #open-advanced-editor {
              display: none;
            }
          }

          & bb-app-view-controller {
            flex: 1 1 auto;
          }
        }

        & #welcome {
          display: flex;
          flex-direction: column;
          gap: var(--bb-grid-size-4);
          height: 100%;
          max-width: 800px;
          margin: 0 auto;

          & > h1 {
            color: var(--sys-color--on-surface);
            margin: 0 0 var(--bb-grid-size-11) 0;
          }

          & > h2 {
            color: var(--sys-color--on-surface);
            margin: 0 0 var(--bb-grid-size-4) 0;
          }

          & > #examples {
            flex: 1;
            position: relative;

            ul {
              list-style: none;
              display: grid;
              padding: 0;
              margin: 0;
              gap: var(--bb-grid-size-3);
              grid-template-columns: repeat(4, 1fr);

              li {
                height: 100%;

                & button {
                  display: flex;
                  flex-direction: column;
                  gap: var(--bb-grid-size-3);
                  height: 100%;
                  align-items: start;
                  justify-content: start;
                  padding: var(--bb-grid-size-4);
                  border-radius: var(--bb-grid-size-4);
                  text-align: left;
                  background: var(--example-color);
                  border: none;
                  color: var(--example-text-color);
                  transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

                  &:not([disabled]) {
                    cursor: pointer;

                    &:hover {
                      background: oklch(
                        from var(--example-color) calc(l * 0.98) c h
                      );
                    }
                  }

                  & .example-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    background: var(--example-icon-background-color);
                    border-radius: 50%;

                    & .g-icon {
                      font-size: 14px;
                      position: relative;
                      color: var(--example-icon-color);
                    }
                  }
                }
              }
            }

            & bb-snackbar {
              position: absolute;
              bottom: 0;
            }
          }

          & bb-editor-input-lite {
            max-width: 90%;
            width: 100%;
            margin: 0 auto;
          }

          & #message {
            margin-bottom: var(--bb-grid-size-4);
          }
        }

        &.full {
          padding: 0;

          #app-view {
            height: 100%;
            border: none;
            border-radius: 0;
            margin: 0;
          }
        }

        &.welcome {
          padding: var(--bb-grid-size-3);
        }

        & bb-splitter {
          height: 100%;
          width: 100%;
        }
      }

      bb-app-controller {
        display: none;

        &.active {
          z-index: 100;
          display: block;
        }
      }

      @container (min-width: 450px) {
        #lite-shell #app-view header .right #open-advanced-editor {
          display: flex;
        }
      }

      @container (min-width: 600px) {
        #lite-shell #app-view header .left #experiment {
          display: block;
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  #sharePanelRef: Ref<SharePanel> = createRef();

  private accessor accessStatus: CheckAppAccessResult | null = null;

  private boardLoaded: Promise<void>;

  /** Get viewType from SCA state */
  get #viewType() {
    return deriveLiteViewType(this.sca, this.sca.controller.editor.graph.empty);
  }

  /** Get generation status from SCA */
  get #status() {
    return this.sca.controller.global.flowgenInput.state.status;
  }

  /** Get graph from SCA */
  get #graph() {
    return this.sca.controller.editor.graph.graph;
  }

  /** Get examples from SCA */
  get #examples() {
    return this.sca.controller.global.flowgenInput.examples;
  }

  constructor(args: MainArguments) {
    super(args);
    this.sca.controller.global.onboarding.appMode = "lite";

    this.addEventListener("bbevent", (e: Event) => {
      const evt = e as StateEvent<keyof StateEventDetailMap>;

      if (evt.detail.eventType === "app.fullscreen") {
        this.showAppFullscreen = evt.detail.action === "activate";
        return;
      }

      if (this.handleUserSignIn(evt)) return;

      return this.handleRoutedEvent(evt);
    });

    // boardLoaded promise that resolves when loadState becomes "Loaded"
    // Uses signal-based waiting instead of event listeners
    this.boardLoaded = this.#waitForLoadState();

    const sizeDetector = window.matchMedia("(max-width: 500px)");
    const reactToScreenWidth = () => {
      if (sizeDetector.matches) {
        this.compactView = true;
      } else {
        this.compactView = false;
      }
    };
    sizeDetector.addEventListener("change", reactToScreenWidth);
    reactToScreenWidth();
  }

  override async doPostInitWork(): Promise<void> {
    await this.sca.controller.global.performMigrations();
    await this.sca.controller.isHydrated;

    // Check fullscreen once when loadState becomes "Loaded" for the first time
    // Effect disposes itself after the initial load check
    let lastLoadState = this.sca.controller.global.main.loadState;
    const stopFullscreenWatch = reactive(() => {
      const currentLoadState = this.sca.controller.global.main.loadState;
      if (currentLoadState === "Loaded" && lastLoadState !== "Loaded") {
        this.#goFullScreenIfGraphIsProbablyShared();
        // Dispose after first load - only needed once at boot
        queueMicrotask(() => stopFullscreenWatch());
      }
      lastLoadState = currentLoadState;
    });

    if (this.sca.controller.router.parsedUrl.page !== "home") return;
    await this.askUserToSignInIfNeeded();
  }

  #goFullScreenIfGraphIsProbablyShared() {
    const gc = this.sca.controller.editor.graph;
    const url = gc.url;
    if (!url) {
      return;
    }
    const fileId = extractGoogleDriveFileId(url);
    if (!fileId) {
      return;
    }
    const isMine = this.sca.services.googleDriveBoardServer.isMine(
      new URL(url)
    );
    const isFeaturedGalleryItem =
      // This is a bit hacky and indirect, but an easy way to tell if something
      // is from the public gallery is to check if the GoogleDriveClient has
      // been configured to use the proxy for it.
      this.sca.services.googleDriveClient.fileIsMarkedForReadingWithPublicProxy(
        fileId
      );
    if (!isMine && !isFeaturedGalleryItem) {
      this.showAppFullscreen = true;
    }
  }

  /**
   * Returns a Promise that resolves when loadState becomes "Loaded".
   * Uses effect-based signal watching with proper disposal.
   */
  #waitForLoadState(): Promise<void> {
    return new Promise<void>((resolve) => {
      const stop = reactive(() => {
        if (this.sca.controller.global.main.loadState === "Loaded") {
          // Use queueMicrotask to ensure effect cleanup happens safely
          queueMicrotask(() => {
            stop();
            resolve();
          });
        }
      });
    });
  }

  override async handleAppAccessCheckResult(
    result: CheckAppAccessResult
  ): Promise<void> {
    this.sca.services.actionTracker.updateCanAccessStatus(result.canAccess);
    if (!result.canAccess) {
      this.accessStatus = result;
      this.sca.controller.global.main.show.add("NoAccessModal");
    } else {
      /**
       * The remix triggering code goes here, though this is a bit of a hack.
       * Ideally, we need some sort of lifecycle and a way to subscribe to
       * events from it
       */
      const parsedUrl = this.sca.controller.router.parsedUrl;
      if (parsedUrl.page !== "graph") return;
      const remixUrl = parsedUrl.remix ? parsedUrl.flow : null;
      if (!remixUrl) return;
      await this.boardLoaded;
      this.sca.services.actionTracker.remixApp(remixUrl, "user");
      this.invokeRemixEventRouteWith(remixUrl);
    }
  }

  /**
   * This method is called by bb-editor-input-lite whenever it needs to
   * generate a new graph.
   */
  async generate(intent: string): Promise<{ error: string } | undefined> {
    if ((await this.askUserToSignInIfNeeded()) !== "success") {
      return { error: "" };
    }
    // await this.sca.controller.global.flowgenInput.isHydrated;
    let hasEditor = !!this.sca.controller.editor.graph.editor;
    this.sca.controller.global.flowgenInput.currentExampleIntent = intent;

    // Set generating state early so the UI shows the editor view throughout
    // the entire flow — including during zero-state board creation, where
    // loadState transitions to "Loaded" while the graph is still empty.
    this.sca.controller.global.flowgenInput.state = { status: "generating" };

    if (!hasEditor) {
      // Zero state: need to create the board first, then wait for load
      await this.invokeBoardCreateRoute();
      await this.#waitForLoadState();

      hasEditor = !!this.sca.controller.editor.graph.editor;
      if (!hasEditor) {
        this.sca.controller.global.flowgenInput.state = { status: "initial" };
        return { error: `Failed to create a new Opal.` };
      }
    }

    const currentGraph = this.sca.controller.editor.graph.graph;
    if (!currentGraph) {
      this.sca.controller.global.flowgenInput.state = { status: "initial" };
      return { error: "No current graph detected, exting flow generation" };
    }

    if (!this.sca.services.flowGenerator) {
      this.sca.controller.global.flowgenInput.state = { status: "initial" };
      return { error: `No FlowGenerator was provided` };
    }

    this.sca.services.stateEventBus.dispatchEvent(
      new StateEvent({ eventType: "flowgen.generate", intent })
    );
  }

  #renderOriginalPrompt() {
    const prompt =
      this.sca.controller.editor.graph.graph?.metadata?.raw_intent ??
      this.sca.controller.editor.graph.graph?.metadata?.intent ??
      this.sca.controller.global.flowgenInput.currentExampleIntent ??
      null;

    return html`<bb-prompt-view
      .prompt=${prompt}
      ?inert=${this.#isInert()}
    ></bb-prompt-view>`;
  }

  protected renderNoAccessModal() {
    const content = getNoAccessModalContent(
      this.accessStatus,
      this.sca.services.guestConfig
    );
    if (!content) return nothing;
    const { title, message } = content;
    return html`
      <bb-modal
        appearance="basic"
        .modalTitle=${title}
        @bbmodaldismissed=${(evt: Event) => {
          evt.preventDefault();
        }}
        ><section id="container">${message}</section></bb-modal
      >
    `;
  }

  #renderUserInput() {
    const editable =
      !this.sca.controller.editor.graph.readOnly || this.#viewType !== "editor";
    return html`<bb-editor-input-lite
      ?inert=${this.#isInert()}
      .controller=${this}
      .editable=${editable}
      @bbsnackbar=${this.#onSnackbar}
      @bbunsnackbar=${this.#onUnSnackbar}
    ></bb-editor-input-lite>`;
  }

  #renderMessage() {
    const editable =
      !this.sca.controller.editor.graph.readOnly || this.#viewType !== "editor";
    return html`<div
      ?disabled=${!editable}
      id="message"
      class="w-400 md-body-small sans-flex"
    >
      ${markdown(Strings.from("LABEL_DISCLAIMER_LITE"))}
    </div>`;
  }

  #renderControls() {
    return html`<div id="controls" slot="slot-0">
      ${[
        this.#renderOriginalPrompt(),
        this.#renderList(),
        this.#renderUserInput(),
        this.#renderMessage(),
      ]}
    </div>`;
  }

  #renderList() {
    return html`
      <bb-step-list-view ?inert=${this.#isInert()} lite></bb-step-list-view>
    `;
  }

  #renderApp() {
    const renderValues = this.getRenderValues();

    const title =
      this.#viewType === "editor"
        ? (this.sca.controller.editor.graph.title ?? "Untitled app")
        : "...";

    const graphIsMine = !this.sca.controller.editor.graph.readOnly;
    const isGenerating = this.#status === "generating";
    const isFreshGraph =
      isGenerating &&
      this.#graph?.edges.length === 0 &&
      this.#graph?.nodes.length === 0 &&
      this.#graph?.title === "Untitled Opal app";

    const buttons: Array<HTMLTemplateResult | symbol> = [];
    if (this.#viewType === "editor") {
      buttons.push(
        html`<a
          class="w-400 md-title-small sans-flex unvaried"
          id="open-advanced-editor"
          href="${this.sca.services.guestConfig.advancedEditorOrigin ||
          this.hostOrigin}?mode=canvas&flow=${this.#graph?.url}"
          target="_blank"
        >
          <span class="g-icon">open_in_new</span>Open Advanced Editor
          <bb-onboarding-tooltip
            .onboardingId=${"advanced-editor"}
          ></bb-onboarding-tooltip>
        </a>`
      );
      if (graphIsMine) {
        buttons.push(
          html`<button
            class="w-400 md-title-small sans-flex unvaried"
            @click=${this.#onClickShareApp}
          >
            <span class="g-icon">share</span>${Strings.from(
              "COMMAND_COPY_APP_PREVIEW_URL"
            )}
          </button>`
        );
      } else {
        buttons.push(
          html`<button
            class="w-400 md-title-small sans-flex unvaried"
            @click=${this.#onClickRemixApp}
          >
            <span class="g-icon">gesture</span>${Strings.from("COMMAND_REMIX")}
            ${html`<bb-onboarding-tooltip
              id="show-remix-warning"
              .onboardingId=${"lite-remix"}
            ></bb-onboarding-tooltip>`}
          </button>`
        );
      }
    }

    return html` <section
      id="app-view"
      slot=${this.showAppFullscreen || this.compactView ? nothing : "slot-1"}
    >
      ${this.showAppFullscreen || this.compactView
        ? nothing
        : html` <header>
            <div class="left w-500 md-title-small sans-flex">
              ${title}

              <span class="sans" id="experiment">Experiment</span>
            </div>
            <div class="right">${buttons}</div>
          </header>`}
      <bb-app-controller
        ?inert=${this.#isInert()}
        class=${classMap({ active: true })}
        .graph=${this.#graph ?? null}
        .graphContentState=${"loaded"}
        .graphTopologyUpdateId=${this.graphTopologyUpdateId}
        .isMine=${!this.sca.controller.editor.graph.readOnly}
        .readOnly=${true}
        .runtimeFlags=${this.sca.controller.global.flags}
        .showGDrive=${this.sca.services.signinAdapter.stateSignal?.status ===
        "signedin"}
        .status=${renderValues.runStatus}
        .themeHash=${this.sca.controller.editor.theme.themeHash}
        .headerConfig=${{
          menu: false,
          replay: true,
          fullscreen:
            this.showAppFullscreen || this.compactView
              ? this.compactView
                ? "no-exit"
                : "active"
              : "available",
          small: true,
        }}
        .isRefreshingAppTheme=${isGenerating}
        .isFreshGraph=${isFreshGraph}
      >
      </bb-app-controller>
      ${this.#renderShellUI()} ${this.renderConsentRequests()}
    </section>`;
  }

  #renderWelcomeMat() {
    return html`<section id="welcome">
      <h1 class="w-400 md-display-small sans-flex">
        Describe the AI mini app you want to build
      </h1>
      <h2 class="w-400 md-title-large sans-flex">
        Looking for inspiration? Try one of our prompts
      </h2>
      <aside id="examples" ?inert=${this.#isInert()}>
        <ul>
          ${repeat(this.#examples, (example) => {
            return html`<li>
              <button
                class="w-400 md-body-small sans-flex"
                @click=${() => {
                  this.sca.controller.global.flowgenInput.currentExampleIntent =
                    example.intent;
                }}
              >
                <span class="example-icon">
                  <span class="g-icon filled heavy round">pentagon</span>
                </span>
                <span>${example.intent}</span>
              </button>
            </li>`;
          })}
        </ul>
      </aside>
      ${[this.#renderUserInput(), this.#renderMessage()]}
    </section>`;
  }

  #renderShellUI() {
    return [
      this.renderTooltip(),
      this.sca.controller.global.main.show.has("NoAccessModal")
        ? this.renderNoAccessModal()
        : nothing,
      this.sca.controller.global.main.show.has("SignInModal")
        ? this.renderSignInModal(false)
        : nothing,
      this.sca.controller.global.main.show.has("SnackbarDetailsModal")
        ? this.renderSnackbarDetailsModal()
        : nothing,
    ];
  }

  #isInert() {
    return (
      this.sca.controller.global.main.blockingAction ||
      this.#status == "generating" ||
      this.#viewType === "loading"
    );
  }

  render() {
    const viewType = this.#viewType;
    const status = this.#status;

    let content: HTMLTemplateResult | symbol = nothing;
    switch (viewType) {
      case "home":
      case "editor":
      case "loading": {
        if (viewType === "home" && status !== "generating") {
          content = this.#renderWelcomeMat();
          break;
        }

        content = html`${this.showAppFullscreen || this.compactView
          ? this.#renderApp()
          : html` <bb-splitter
              direction=${"horizontal"}
              name="layout-lite"
              split="[0.30, 0.70]"
            >
              ${[this.#renderControls(), this.#renderApp()]}
            </bb-splitter>`}`;
        break;
      }
      case "error":
        return html`<section id="lite-shell" @bbevent=${this.handleUserSignIn}>
          <div id="error">${Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT")}</div>
          ${this.#renderShellUI()}
        </section>`;
      default:
        console.log("Invalid lite view state");
        return nothing;
    }

    return html`<section
        id="lite-shell"
        class=${classMap({
          full: this.showAppFullscreen || this.compactView,
          welcome: viewType === "home",
        })}
        @bbsnackbar=${this.#onSnackbar}
        @bbunsnackbar=${this.#onUnSnackbar}
        @bbsharerequested=${this.#onClickShareApp}
      >
        ${content}
      </section>
      ${this.#renderShellUI()} ${this.#renderSharePanel()}
      ${this.renderSnackbar()} ${this.renderNotebookLmPicker()} `;
  }

  #onSnackbar(event: BreadboardUI.Events.SnackbarEvent) {
    this.sca.controller.global.snackbars.snackbar(
      event.message,
      event.snackType,
      event.actions,
      event.persistent,
      event.snackbarId,
      event.replaceAll
    );
  }

  #onUnSnackbar(event: BreadboardUI.Events.UnsnackbarEvent) {
    this.sca.controller.global.snackbars.unsnackbar(event.snackbarId);
  }

  protected invokeBoardCreateRoute() {
    this.sca.services.stateEventBus.dispatchEvent(
      new BreadboardUI.Events.StateEvent({
        eventType: "board.create",
        editHistoryCreator: { role: "user" },
        graph: blankBoard(),
        messages: {
          start: "",
          end: "",
          error: "",
        },
      })
    );
  }

  private handleUserSignIn(
    evt: StateEvent<keyof StateEventDetailMap>
  ): boolean {
    if (evt.detail.eventType !== "host.usersignin") return false;

    const { result } = evt.detail;

    if (result === "success") return true;

    // Error case: when loading an inaccessible opal, the render method's
    // error case will display the appropriate message
    return true;
  }

  #renderSharePanel() {
    return html`
      <bb-share-panel ${ref(this.#sharePanelRef)}></bb-share-panel>
    `;
  }

  #onClickShareApp() {
    this.#sharePanelRef.value?.open();
  }

  #onClickRemixApp() {
    const url = this.#graph?.url;
    if (!url) {
      return;
    }

    this.invokeRemixEventRouteWith(url);
  }
}

function getNoAccessModalContent(
  status: CheckAppAccessResult | null,
  guestConfiguration: GuestConfiguration | undefined
): { title: string; message: string } | null {
  const title = "Access Denied";
  if (!status) return null;
  if (status.canAccess) return null;
  switch (status.accessStatus) {
    case "ACCESS_STATUS_DASHER_ACCOUNT":
      return {
        title,
        message:
          guestConfiguration?.noAccessDasherMessage ||
          "Switch to a personal Google Account that you use to access Opal",
      };
    case "ACCESS_STATUS_REGION_RESTRICTED":
      return {
        title,
        message:
          guestConfiguration?.noAccessRegionRestrictedMessage ||
          "It looks like Opal isn't available in your country yet. We're working hard to bring Opal to new countries soon.",
      };
    default:
      return {
        title,
        message: "It looks like this account can't access Opal yet.",
      };
  }
}
