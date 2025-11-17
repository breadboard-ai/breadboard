/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { MainArguments } from "./types/types";

import * as BBLite from "@breadboard-ai/shared-ui/lite";
import { MainBase, RenderValues } from "./main-base";
import { StepListState } from "@breadboard-ai/shared-ui/state/types.js";
import { classMap } from "lit/directives/class-map.js";
import {
  StateEvent,
  StateEventDetailMap,
} from "@breadboard-ai/shared-ui/events/events.js";

@customElement("bb-lite")
export class LiteMain extends MainBase {
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
        padding: var(--bb-grid-size-3);

        & #app-view {
          margin: 0 0 0 var(--bb-grid-size-3);
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

  #renderList(state: StepListState | undefined) {
    return html`<div id="controls-view" slot="slot-0">
      <bb-step-list-view .state=${state}></bb-step-list-view>
    </div>`;
  }

  #renderApp(renderValues: RenderValues) {
    return html` <div
      id="app-view"
      slot="slot-1"
      @bbevent=${async (evt: StateEvent<keyof StateEventDetailMap>) =>
        this.handleRoutedEvent(evt)}
    >
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
    </div>`;
  }

  render() {
    if (!this.ready) return nothing;

    switch (this.uiState.loadState) {
      case "Home":
        return html`Home (TODO)`;
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

    return html`<section id="lite-shell">
      <bb-splitter
        direction=${"horizontal"}
        name="layout-main"
        split="[0.70, 0.30]"
      >
        ${[
          this.#renderList(renderValues.projectState?.run.stepList),
          this.#renderApp(renderValues),
        ]}
      </bb-splitter>
    </section>`;
  }
}
