/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import { html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MainArguments } from "./types/types";

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import { MainBase } from "./main-base";
import { classMap } from "lit/directives/class-map.js";
import {
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";
import { LiteEditInputController } from "@breadboard-ai/shared-ui/lite/input/editor-input-lite.js";
import { GraphDescriptor, GraphTheme } from "@breadboard-ai/types";
import {
  RuntimeBoardLoadErrorEvent,
  RuntimeTabChangeEvent,
} from "./runtime/events";
import { eventRoutes } from "./event-routing/event-routing";
import { blankBoard } from "@breadboard-ai/shared-ui/utils/utils.js";
import { repeat } from "lit/directives/repeat.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { OneShotFlowGenFailureResponse } from "@breadboard-ai/shared-ui/flow-gen/flow-generator.js";
import { flowGenWithTheme } from "@breadboard-ai/shared-ui/flow-gen/flowgen-with-theme.js";
import { EmbedHandler } from "@breadboard-ai/types/embedder.js";
import { markdown } from "@breadboard-ai/shared-ui/directives/markdown.js";

const ADVANCED_EDITOR_KEY = "bb-lite-advanced-editor";

@customElement("bb-lite")
export class LiteMain extends MainBase implements LiteEditInputController {
  @property()
  accessor showAppFullscreen = false;

  @state()
  accessor #showAdvancedEditorOnboardingTooltip = true;

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
          height: var(--bb-grid-size-4);
          margin: var(--bb-grid-size-2) 0;
          color: var(--sys-color--on-surface-variant);

          p {
            margin: 0;
          }

          a {
            color: var(--sys-color--on-surface);
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
          margin-bottom: var(--bb-grid-size-13);

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
            padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-5);
            background: var(--sys-color--surface);
            color: var(--sys-color--on-surface);

            & .left {
              flex: 1;
            }

            & .left,
            & .right {
              display: flex;
              align-items: center;
              white-space: nowrap;
              gap: var(--bb-grid-size-8);
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

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }
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

  #advancedEditorLink: Ref<HTMLElement> = createRef();
  readonly #embedHandler?: EmbedHandler;

  constructor(args: MainArguments) {
    super(args);

    const { parsedUrl, embedHandler } = args;

    this.#embedHandler = embedHandler;

    // Set the app to fullscreen if the parsed URL indicates that this was
    // opened from a share action.
    this.showAppFullscreen =
      (parsedUrl && "flow" in parsedUrl && parsedUrl.shared) ?? false;

    this.#showAdvancedEditorOnboardingTooltip =
      (globalThis.localStorage.getItem(ADVANCED_EDITOR_KEY) ?? "true") ===
      "true";
  }

  override async doPostInitWork(): Promise<void> {
    this.runtime.board.addEventListener(
      RuntimeBoardLoadErrorEvent.eventName,
      () => {
        this.runtime.state.lite.viewError = Strings.from(
          "ERROR_UNABLE_TO_LOAD_PROJECT"
        );
      }
    );

    const parsedUrl = this.runtime.router.parsedUrl;
    switch (parsedUrl.page) {
      case "graph": {
        let resolve: () => void;
        const waitForBoardToLoad = new Promise<void>((r) => {
          resolve = r;
        });
        this.runtime.board.addEventListener(
          RuntimeTabChangeEvent.eventName,
          () => resolve!(),
          { once: true }
        );

        const remixUrl = parsedUrl.remix ? parsedUrl.flow : null;
        if (remixUrl) {
          await waitForBoardToLoad;
          this.invokeRemixEventRouteWith(remixUrl);
        }
        break;
      }
      case "home": {
        await this.askUserToSignInIfNeeded();
      }
    }
  }

  /**
   * This method is called by bb-editor-input-lite whenever it needs to
   * generate a new graph.
   */
  async generate(
    intent: string
  ): Promise<OneShotFlowGenFailureResponse | undefined> {
    if ((await this.askUserToSignInIfNeeded()) !== "success") {
      return { error: "" };
    }
    let projectState = this.runtime.state.project;
    this.runtime.state.lite.currentExampleIntent = intent;

    if (!projectState) {
      // This is a zero state: we don't yet have a projectState.
      // Let's create it.

      // This is plain nasty: we're basically trying to line up a bunch of
      // event-driven operations into a sequence of async invocations.
      let resolve: (() => void) | undefined = undefined;
      const waitForTabToChange = new Promise<void>((resolveToSave) => {
        resolve = resolveToSave;
      });
      this.runtime.board.addEventListener(
        RuntimeTabChangeEvent.eventName,
        () => resolve?.(),
        { once: true }
      );
      await this.invokeBoardCreateRoute();
      await waitForTabToChange;
      projectState = this.runtime.state.project;
      if (!projectState) {
        return { error: `Failed to create a new opal.` };
      }
    }

    const currentGraph = this.runtime.state.lite.graph;
    if (!currentGraph) {
      return { error: "No current graph detected, exting flow generation" };
    }

    if (!this.flowGenerator) {
      return { error: `No FlowGenerator was provided` };
    }

    const generated = await flowGenWithTheme(
      this.flowGenerator,
      intent,
      currentGraph,
      projectState
    );
    if ("error" in generated) {
      return generated;
    }
    await this.invokeBoardReplaceRoute(generated.flow, generated.theme);
  }

  #renderOriginalPrompt() {
    const prompt =
      this.tab?.graph.metadata?.intent ??
      this.runtime.state.lite.currentExampleIntent ??
      null;

    return html`<bb-prompt-view
      .prompt=${prompt}
      .state=${this.runtime.state.lite}
    ></bb-prompt-view>`;
  }

  #renderUserInput() {
    const { lite } = this.runtime.state;
    return html`<bb-editor-input-lite
      .controller=${this}
      .state=${lite}
    ></bb-editor-input-lite>`;
  }

  #renderMessage() {
    return html`<div id="message" class="w-400 md-body-small sans-flex">
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
      <bb-step-list-view .state=${this.runtime.state.lite}></bb-step-list-view>
    `;
  }

  #renderOnboardingTooltip() {
    if (
      !this.#showAdvancedEditorOnboardingTooltip ||
      !this.#advancedEditorLink.value
    ) {
      return nothing;
    }

    const targetBounds = this.#advancedEditorLink.value.getBoundingClientRect();
    if (!targetBounds.width) {
      return nothing;
    }

    const PADDING = 30;
    const x = Math.round(window.innerWidth - targetBounds.right + PADDING);
    const y = Math.round(targetBounds.y + targetBounds.height + PADDING);
    const styles: Record<string, string> = {
      "--right": `${x}px`,
      "--top": `${y}px`,
    };

    return html`<bb-onboarding-tooltip
      @bbonboardingacknowledged=${() => {
        this.#showAdvancedEditorOnboardingTooltip = false;
        globalThis.localStorage.setItem(ADVANCED_EDITOR_KEY, "false");
      }}
      style=${styleMap(styles)}
      .text=${"To edit or view full prompt, open in advanced editor"}
    ></bb-onboarding-tooltip>`;
  }

  #renderApp() {
    const renderValues = this.getRenderValues();

    const title =
      this.runtime.state.lite.viewType === "editor"
        ? (this.tab?.graph.title ?? "Untitled app")
        : "...";

    return html` <section
      id="app-view"
      slot=${this.showAppFullscreen ? nothing : "slot-1"}
    >
      ${this.showAppFullscreen
        ? nothing
        : html` <header class="w-400 md-title-small sans-flex">
            <div class="left">${title}</div>
            <div class="right">
              <button
                ${ref(this.#advancedEditorLink)}
                href="${this.hostOrigin}?mode=canvas&flow=${this.tab?.graph
                  .url}"
                @click=${() => {
                  if (!this.#embedHandler || !this.tab?.graph.url) {
                    this.snackbar(
                      html`Unable to open Advanced Editor`,
                      BreadboardUI.Types.SnackType.ERROR
                    );
                    return;
                  }

                  this.#embedHandler.sendToEmbedder({
                    type: "open_in_advanced_editor",
                    boardId: this.tab.graph.url,
                  });
                }}
              >
                <span class="g-icon">open_in_new</span>Open Advanced Editor
              </button>
              <button
                @click=${() => {
                  if (!this.#embedHandler || !this.tab?.graph.url) {
                    this.snackbar(
                      html`Unable to share`,
                      BreadboardUI.Types.SnackType.ERROR
                    );
                    return;
                  }

                  this.#embedHandler.sendToEmbedder({
                    type: "trigger_share",
                    boardId: this.tab.graph.url,
                  });
                }}
              >
                <span class="g-icon">share</span>Share
              </button>
            </div>
          </header>`}
      <bb-app-controller
        class=${classMap({ active: true })}
        .graph=${this.tab?.graph ?? null}
        .graphIsEmpty=${false}
        .graphTopologyUpdateId=${this.graphTopologyUpdateId}
        .isMine=${this.tab?.graphIsMine ?? false}
        .projectRun=${renderValues.projectState?.run}
        .readOnly=${true}
        .runtimeFlags=${this.uiState.flags}
        .showGDrive=${this.signinAdapter.state === "signedin"}
        .status=${renderValues.tabStatus}
        .themeHash=${renderValues.themeHash}
        .headerConfig=${{
          menu: false,
          replay: true,
          fullscreen: this.showAppFullscreen ? "active" : "available",
          small: true,
        }}
        .systemThemeOverride=${true}
      >
      </bb-app-controller>
      ${this.renderSnackbar()} ${this.#renderShellUI()}
      ${this.renderConsentRequests()}
    </section>`;
  }

  #renderWelcomeMat() {
    return html`<section id="welcome">
      <h1 class="w-400 md-display-small sans-flex">
        What do you want to build?
      </h1>
      <h2 class="w-400 md-title-large sans-flex">
        Looking for inspiration? Try one of our prompts
      </h2>
      <aside id="examples">
        <ul>
          ${repeat(this.runtime.state.lite.examples, (example) => {
            return html`<li>
              <button
                class="w-400 md-body-small sans-flex"
                @click=${() => {
                  this.runtime.state.lite.currentExampleIntent = example.intent;
                }}
              >
                <span class="example-icon">
                  <span class="g-icon filled-heavy round">pentagon</span>
                </span>
                <span>${example.intent}</span>
              </button>
            </li>`;
          })}
        </ul>
        ${this.renderSnackbar()}
      </aside>
      ${[this.#renderUserInput(), this.#renderMessage()]}
    </section>`;
  }

  #renderShellUI() {
    return [
      this.renderTooltip(),
      this.#renderOnboardingTooltip(),
      this.uiState.show.has("SignInModal") ? this.renderSignInModal() : nothing,
    ];
  }

  render() {
    const lite: BreadboardUI.State.LiteModeState = this.runtime.state.lite;

    let content: HTMLTemplateResult | symbol = nothing;
    switch (lite.viewType) {
      case "home":
      case "editor":
      case "loading": {
        if (lite.viewType === "home" && lite.status !== "generating") {
          content = this.#renderWelcomeMat();
          break;
        }

        content = html`${this.showAppFullscreen
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
          <div id="error">${lite.viewError}</div>
          ${this.renderSnackbar()}${this.#renderShellUI()}
        </section>`;
      default:
        console.log("Invalid lite view state");
        return nothing;
    }

    return html`<section
        ?inert=${this.uiState.blockingAction ||
        lite.status == "generating" ||
        lite.viewType === "loading"}
        id="lite-shell"
        class=${classMap({
          full: this.showAppFullscreen,
          welcome: lite.viewType === "home",
        })}
        @bbsnackbar=${(snackbarEvent: BreadboardUI.Events.SnackbarEvent) => {
          this.snackbar(
            snackbarEvent.message,
            snackbarEvent.snackType,
            snackbarEvent.actions,
            snackbarEvent.persistent,
            snackbarEvent.snackbarId,
            snackbarEvent.replaceAll
          );
        }}
        @bbunsnackbar=${(
          unsnackbarEvent: BreadboardUI.Events.UnsnackbarEvent
        ) => {
          this.unsnackbar(unsnackbarEvent.snackbarId);
        }}
        @bbevent=${(evt: StateEvent<keyof StateEventDetailMap>) => {
          if (evt.detail.eventType === "app.fullscreen") {
            this.showAppFullscreen = evt.detail.action === "activate";
            return;
          }

          if (this.handleUserSignIn(evt)) return;

          return this.handleRoutedEvent(evt);
        }}
      >
        ${content}
      </section>
      ${this.#renderShellUI()}`;
  }

  protected async invokeBoardReplaceRoute(
    replacement: GraphDescriptor,
    theme: GraphTheme | undefined
  ) {
    return eventRoutes.get("board.replace")?.do(
      this.collectEventRouteDeps(
        new BreadboardUI.Events.StateEvent({
          eventType: "board.replace",
          replacement,
          theme,
          creator: { role: "assistant" },
        })
      )
    );
  }

  protected async invokeBoardCreateRoute() {
    return eventRoutes.get("board.create")?.do(
      this.collectEventRouteDeps(
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
      )
    );
  }

  private handleUserSignIn(
    evt: StateEvent<keyof StateEventDetailMap>
  ): boolean {
    if (evt.detail.eventType !== "host.usersignin") return false;

    const { result } = evt.detail;
    const { lite } = this.runtime.state;

    if (result === "success") return true;

    if (lite.viewType === "loading") {
      // Happens when loading an inacessible opal
      lite.viewError = Strings.from("ERROR_UNABLE_TO_LOAD_PROJECT");
    }
    return true;
  }
}
