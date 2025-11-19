/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import { html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { MainArguments } from "./types/types";

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import { MainBase } from "./main-base";
import { StepListState } from "@breadboard-ai/shared-ui/state/types.js";
import { classMap } from "lit/directives/class-map.js";
import {
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";
import { ref } from "lit/directives/ref.js";
import { parseUrl } from "@breadboard-ai/shared-ui/utils/urls.js";
import { LiteEditInputController } from "@breadboard-ai/shared-ui/lite/input/editor-input-lite.js";
import { GraphDescriptor, GraphTheme, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { RuntimeTabChangeEvent } from "./runtime/events";
import { eventRoutes } from "./event-routing/event-routing";
import { blankBoard } from "@breadboard-ai/shared-ui/utils/utils.js";

@customElement("bb-lite")
export class LiteMain extends MainBase implements LiteEditInputController {
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

  // The snackbar is not held as a Ref because we need to track pending snackbar
  // messages as they are coming in and, once the snackbar has rendered, we add
  // them. This means we use the ref callback to handle this case instead of
  // using to create and store the reference itself.
  #snackbar: BBLite.Snackbar | undefined = undefined;
  #pendingSnackbarMessages: Array<{
    message: BBLite.Types.SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  constructor(args: MainArguments) {
    super(args);
  }

  /**
   * This method is called by bb-editor-input-lite whenever it needs to
   * generate a new graph.
   */
  async generate(intent: string): Promise<Outcome<void>> {
    let projectState = this.getProjectState();

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
      projectState = this.getProjectState();
      if (!projectState) {
        return err(`Failed to create a new opal.`);
      }
    }

    const currentGraph = projectState.run.stepList.graph;
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
    return html`<bb-prompt-view
      .prompt=${this.tab?.graph.metadata?.intent}
    ></bb-prompt-view>`;
  }

  #renderUserInput(state: StepListState | undefined) {
    return html`<bb-editor-input-lite
      .controller=${this}
      .state=${this.runtime.state.liteView}
      .hasEmptyGraph=${state?.empty}
      .currentGraph=${state?.graph}
    ></bb-editor-input-lite>`;
  }

  #renderMessage() {
    return html`<p id="message" class="w-400 md-body-small sans-flex">
      ${Strings.from("LABEL_DISCLAIMER")}
    </p>`;
  }

  #renderControls(state: StepListState | undefined) {
    return html`<div id="controls" slot="slot-0">
      ${[
        this.#renderOriginalPrompt(),
        this.#renderList(state),
        this.#renderUserInput(state),
        this.#renderMessage(),
      ]}
    </div>`;
  }

  #renderList(state: StepListState | undefined) {
    return html` <bb-step-list-view .state=${state}></bb-step-list-view> `;
  }

  #renderApp() {
    const renderValues = this.getRenderValues();
    return html` <section id="app-view" slot="slot-1">
      <header class="w-400 md-title-small sans-flex">
        <div class="left">${this.tab?.name ?? "Untitled app"}</div>
        <div class="right">
          <a href="/?mode=canvas&flow=${this.tab?.graph.url}" target="_blank"
            ><span class="g-icon">open_in_new</span>Open Advanced Editor</a
          >
          <button><span class="g-icon">share</span>Share</button>
        </div>
      </header>
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
          fullscreen: true,
          small: true,
        }}
      >
      </bb-app-controller>
      ${this.#renderSnackbar()}
    </section>`;
  }

  #renderWelcomeMat() {
    return html`<h1>What do you want to build?</h1>`;
  }

  #renderSnackbar() {
    return html`<bb-snackbar
      ${ref((el: Element | undefined) => {
        if (!el) {
          this.#snackbar = undefined;
        }

        this.#snackbar = el as BreadboardUI.Elements.Snackbar;
        for (const pendingMessage of this.#pendingSnackbarMessages) {
          const { message, id, persistent, type, actions } =
            pendingMessage.message;
          this.snackbar(message, type, actions, persistent, id);
        }

        this.#pendingSnackbarMessages.length = 0;
      })}
    ></bb-snackbar>`;
  }

  render() {
    if (!this.ready) return nothing;

    let zeroState = false;

    switch (this.uiState.loadState) {
      case "Home": {
        const parsedUrl = parseUrl(window.location.href);
        zeroState = !!(parsedUrl.page === "home" && parsedUrl.new);
        if (!zeroState) {
          console.warn("Invalid Home URL state", parsedUrl);
          return nothing;
        }
        break;
      }
      case "Loading":
        return html`<div id="loading">
          <span class="g-icon heavy-filled round">progress_activity</span
          >Loading
        </div>`;
      case "Error":
        return html`Error`;
      case "Loaded": {
        this.unsnackbar();
        break;
      }
      default:
        console.warn("Unknown UI load state", this.uiState.loadState);
        return nothing;
    }

    const stepList = this.getProjectState()?.run.stepList;

    if (stepList?.empty || zeroState) {
      // For new graph or zero-state, show the welcome mat and no app view.
      return html`<section
        id="lite-shell"
        @bbevent=${(evt: StateEvent<keyof StateEventDetailMap>) =>
          this.handleRoutedEvent(evt)}
      >
        ${[this.#renderWelcomeMat(), this.#renderUserInput(stepList)]}
      </section>`;
    } else {
      // When there are nodes in the graph, show the app view.
      return html`<section
        id="lite-shell"
        @bbevent=${(evt: StateEvent<keyof StateEventDetailMap>) =>
          this.handleRoutedEvent(evt)}
      >
        <bb-splitter
          direction=${"horizontal"}
          name="layout-lite"
          split="[0.30, 0.70]"
        >
          ${[this.#renderControls(stepList), this.#renderApp()]}
        </bb-splitter>
      </section>`;
    }
  }

  snackbar(
    message: string | HTMLTemplateResult,
    type: BBLite.Types.SnackType,
    actions: BBLite.Types.SnackbarAction[] = [],
    persistent = false,
    id = globalThis.crypto.randomUUID(),
    replaceAll = false
  ) {
    if (!this.#snackbar) {
      this.#pendingSnackbarMessages.push({
        message: {
          id,
          message,
          type,
          persistent,
          actions,
        },
        replaceAll,
      });
      return;
    }

    return this.#snackbar.show(
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

  unsnackbar(id?: BreadboardUI.Types.SnackbarUUID) {
    if (!this.#snackbar) {
      return;
    }

    this.#snackbar.hide(id);
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

  getProjectState() {
    const mainGraphId = this.tab?.mainGraphId;

    return mainGraphId
      ? this.runtime.state.getOrCreateProjectState(
          mainGraphId,
          this.runtime.edit.getEditor(this.tab)
        )
      : null;
  }
}
