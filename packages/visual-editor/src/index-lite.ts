/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import { html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MainArguments } from "./types/types";

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import { MainBase } from "./main-base";
import { classMap } from "lit/directives/class-map.js";
import {
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";
import { LiteEditInputController } from "@breadboard-ai/shared-ui/lite/input/editor-input-lite.js";
import { GraphDescriptor, GraphTheme, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { RuntimeTabChangeEvent } from "./runtime/events";
import { eventRoutes } from "./event-routing/event-routing";
import { blankBoard } from "@breadboard-ai/shared-ui/utils/utils.js";
import { repeat } from "lit/directives/repeat.js";

@customElement("bb-lite")
export class LiteMain extends MainBase implements LiteEditInputController {
  @property()
  accessor showAppFullscreen = false;

  static styles = [
    BBLite.Styles.HostIcons.icons,
    BBLite.Styles.HostBehavior.behavior,
    BBLite.Styles.HostColors.baseColors,
    BBLite.Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: 1;

        --example-color: light-dark(#e9eef6, #000000);
        --example-text-color: light-dark(#575b5f, #ffffff);
        --example-icon-background-color: light-dark(#d9d7fd, #ffffff);
        --example-icon-color: light-dark(#665ef6, #ffffff);
      }

      #loading {
        display: flex;
        height: 100%;
        width: 100%;
        align-items: center;
        justify-content: center;

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
          color: light-dark(#575b5f, #fff);
        }

        & #app-view {
          position: relative;
          margin: 0 0 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-4);
          border: 1px solid var(--light-dark-n-90);
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
            color: var(--light-dark-n-10);

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
              color: var(--light-dark-n-10);
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

          & > h1 {
            margin: 0 0 var(--bb-grid-size-11) 0;
          }

          & > h2 {
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

  constructor(args: MainArguments) {
    super(args);

    // Set the app to fullscreen if the parsed URL indicates that this was
    // opened from a share action.
    this.showAppFullscreen =
      (args.parsedUrl && "flow" in args.parsedUrl && args.parsedUrl.shared) ??
      false;
  }

  /**
   * This method is called by bb-editor-input-lite whenever it needs to
   * generate a new graph.
   */
  async generate(intent: string): Promise<Outcome<void>> {
    let projectState = this.runtime.state.project;

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
      const url = this.tab?.graph.url;
      if (url) {
        this.notifyEmbeddedBoardCreated(url);
      }
      projectState = this.runtime.state.project;
      if (!projectState) {
        return err(`Failed to create a new opal.`);
      }
    }

    const currentGraph = this.runtime.state.liteView.graph;
    if (!currentGraph) {
      console.warn("No current graph detected, exting flow generation");
      return;
    }

    if (!this.flowGenerator) {
      return err(`No FlowGenerator was provided`);
    }
    const generating = this.flowGenerator.oneShot({
      intent,
      context: { flow: currentGraph },
    });

    const newGraph = (currentGraph?.nodes.length || 0) === 0;
    const creatingTheme = newGraph
      ? projectState.themes.generateThemeFromIntent(intent)
      : Promise.resolve(err(`Existing graph, skipping theme generation`));

    const [generated, createdTheme] = await Promise.allSettled([
      generating,
      creatingTheme,
    ]);

    if (generated.status === "rejected") {
      return err(generated.reason);
    }
    let theme;
    if (createdTheme.status === "fulfilled" && ok(createdTheme.value)) {
      theme = createdTheme.value;
    }
    const { flow } = generated.value;
    await this.invokeBoardReplaceRoute(flow, theme);
  }

  #renderOriginalPrompt() {
    if (!this.tab?.graph.metadata?.intent) {
      return nothing;
    }

    return html`<bb-prompt-view
      .prompt=${this.tab?.graph.metadata?.intent}
    ></bb-prompt-view>`;
  }

  #renderUserInput() {
    const { liteView } = this.runtime.state;
    return html`<bb-editor-input-lite
      .controller=${this}
      .state=${liteView}
    ></bb-editor-input-lite>`;
  }

  #renderMessage() {
    return html`<p id="message" class="w-400 md-body-small sans-flex">
      ${Strings.from("LABEL_DISCLAIMER")}
    </p>`;
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
      <bb-step-list-view
        .state=${this.runtime.state.liteView.stepList}
      ></bb-step-list-view>
    `;
  }

  #renderApp() {
    const renderValues = this.getRenderValues();
    return html` <section
      id="app-view"
      slot=${this.showAppFullscreen ? nothing : "slot-1"}
    >
      ${this.showAppFullscreen
        ? nothing
        : html` <header class="w-400 md-title-small sans-flex">
            <div class="left">${this.tab?.name ?? "Untitled app"}</div>
            <div class="right">
              <a
                href="/?mode=canvas&flow=${this.tab?.graph.url}"
                target="_blank"
                ><span class="g-icon">open_in_new</span>Open Advanced Editor</a
              >
              <button><span class="g-icon">share</span>Share</button>
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
      >
      </bb-app-controller>
      ${this.renderSnackbar()}
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
          ${repeat(this.runtime.state.liteView.examples, (example) => {
            return html`<li>
              <button
                class="w-400 md-body-small sans-flex"
                @click=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLButtonElement)) return;

                  this.runtime.state.liteView.currentExampleIntent =
                    example.intent;
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
    return [this.renderTooltip()];
  }

  render() {
    if (!this.ready) return nothing;

    const { viewType } = { viewType: "home" }; //this.runtime.state.liteView;

    let content: HTMLTemplateResult | symbol = nothing;
    switch (viewType) {
      case "home": {
        content = this.#renderWelcomeMat();
        break;
      }
      case "editor": {
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
      case "loading":
        return html`<div id="loading">
          <span class="g-icon heavy-filled round">progress_activity</span
          >Loading
        </div>`;
      default:
        console.log("Invalid lite view state");
        return nothing;
    }

    return html`<section
        id="lite-shell"
        class=${classMap({
          full: this.showAppFullscreen,
          welcome: viewType === "home",
        })}
        ?inert=${this.uiState.blockingAction}
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
        @bbevent=${(evt: StateEvent<keyof StateEventDetailMap>) => {
          if (evt.detail.eventType === "app.fullscreen") {
            this.showAppFullscreen = evt.detail.action === "activate";
            return;
          }

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
}
