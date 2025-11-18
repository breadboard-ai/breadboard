/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
const Strings = BreadboardUI.Strings.forSection("Global");

import { html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { MainArguments } from "./types/types";

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import { MainBase, RenderValues } from "./main-base";
import {
  Project,
  StepListState,
} from "@breadboard-ai/shared-ui/state/types.js";
import { classMap } from "lit/directives/class-map.js";
import {
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";
import { provide } from "@lit/context";
import { projectStateContext } from "@breadboard-ai/shared-ui/contexts";
import { ActionTracker } from "@breadboard-ai/shared-ui/utils/action-tracker";
import { blankBoard } from "@breadboard-ai/shared-ui/utils/utils.js";

@customElement("bb-lite")
export class LiteMain extends MainBase {
  @provide({ context: projectStateContext })
  @state()
  accessor projectState: Project | undefined;

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
          margin: 0 0 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-4);
          border: 1px solid var(--light-dark-n-90);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-bottom: var(--bb-grid-size-13);

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
    `,
  ];

  constructor(args: MainArguments) {
    super(args);
  }

  #renderOriginalPrompt() {
    return html`<bb-prompt-view
      .prompt=${this.tab?.graph.metadata?.intent}
    ></bb-prompt-view>`;
  }

  #renderUserInput(state: StepListState | undefined) {
    return html`<bb-editor-input-lite
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

  #renderApp(renderValues: RenderValues) {
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
      >
      </bb-app-controller>
    </section>`;
  }

  #renderWelcomeMat() {
    return html`<h1>What do you want to build?</h1>`;
  }

  #renderHome() {
    return html`<section id="home">
      <h1>HOME</h1>
      <button
        @click=${(evt: Event) => {
          if (!(evt.target instanceof HTMLButtonElement)) {
            return;
          }

          ActionTracker.createNew();

          evt.target.disabled = true;
          this.handleRoutedEvent(
            new StateEvent({
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
        }}
      >
        CREATE
      </button>
    </section>`;
  }

  render() {
    if (!this.ready) return nothing;

    switch (this.uiState.loadState) {
      case "Home":
        // This likely does not belong here.
        // TODO: Figure out what the right thing is.
        return this.#renderHome();
      case "Loading":
        return html`Loading (TODO)`;
      case "Error":
        return html`Error (TODO)`;
      case "Loaded":
        break;
      default:
        console.warn("Unknown UI load state", this.uiState.loadState);
        return nothing;
    }

    const renderValues = this.getRenderValues();

    this.projectState = renderValues.projectState || undefined;

    const stepList = renderValues.projectState?.run.stepList;

    if (stepList?.empty) {
      // For new graph, show the welcome mat and no app view.
      return html`<section
        id="lite-shell"
        @bbevent=${(evt: StateEvent<keyof StateEventDetailMap>) =>
          this.handleRoutedEvent(evt)}
      >
        ${[this.#renderWelcomeMat(), this.#renderList(stepList)]}
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
          ${[this.#renderControls(stepList), this.#renderApp(renderValues)]}
        </bb-splitter>
      </section>`;
    }
  }
}
