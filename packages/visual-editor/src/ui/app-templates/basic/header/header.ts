/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { icons } from "../../../styles/icons.js";
import { styleMap } from "lit/directives/style-map.js";
import { SideNav } from "./side-nav.js";
import { type } from "../../../styles/host/type.js";

import "./side-nav.js";
import {
  HideTooltipEvent,
  ShowTooltipEvent,
  StateEvent,
} from "../../../events/events.js";

const REPLAY_WARNING_KEY = "bb-app-header-show-replay-warning";

@customElement("bb-app-header")
export class Header extends LitElement {
  @property()
  accessor progress = 0; /** 0 -> 1 */

  @property({ reflect: true, type: Boolean })
  accessor neutral = false;

  @property()
  accessor menuActive = false;

  @property()
  accessor replayActive = false;

  @property()
  accessor fullScreenActive: "available" | "active" | "no-exit" | null = null;

  @property({ reflect: true, type: Boolean })
  accessor small = false;

  @property()
  accessor running = false;

  @property()
  accessor replayAutoStart = false;

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appURL: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor isEmpty = false;

  @query("#side-nav")
  accessor #sideNav: SideNav | null = null;

  @state()
  accessor #showReplayWarning = false;

  static styles = [
    icons,
    type,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 54px;
        border-bottom: 1px solid light-dark(var(--s-70), var(--p-50));
        padding: 0 var(--bb-grid-size-4);
        position: relative;
        flex: 0 0 auto;
        z-index: 2;
        color: var(--light-dark-p-40, var(--light-dark-n-10));
      }

      :host([neutral]) {
        border-top: 1px solid light-dark(var(--n-95), var(--n-30));
        border-bottom: 1px solid light-dark(--light-dark-n-95), var(--n-30));
      }

      #fullscreen,
      #menu,
      #replay {
        position: relative;
        width: 30px;
        height: 30px;
        background: transparent;
        border: none;
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        padding: 0;
        color: light-dark(var(--p-35), var(--p-80));
        border-radius: 50%;
        width: 82px;

        & .g-icon {
          font-size: 30px;
        }

        &:not([disabled]) {
          cursor: pointer;
          opacity: 0.6;

          &:focus,
          &:hover {
            opacity: 1;
          }
        }

        bb-onboarding-tooltip {
          display: none;
        }

        &:hover bb-onboarding-tooltip {
          display: flex;
        }
        bb-onboarding-tooltip:hover {
          display: flex;
        }
      }

      #fullscreen,
      #menu {
        display: flex;
        justify-content: start;
      }

      #replay {
        display: flex;
        justify-content: end;
      }

      #replay-autostart {
        display: flex;
        align-items: center;
        height: 32px;
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
        border: 1px solid light-dark(var(--n-80), var(--n-30));
        border-radius: var(--bb-grid-size-16);
        background: light-dark(var(--n-100), var(--n-20));
        gap: var(--bb-grid-size-2);
        color: light-dark(var(--n-35), var(--n-90));
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        width: 82px;

        > * {
          pointer-events: none;
        }

        & .g-icon {
          width: 18px;
          height: 18px;
          font-size: 18px;
        }

        &:not([disabled]) {
          cursor: pointer;
          opacity: 0.6;

          &:focus,
          &:hover {
            opacity: 1;
          }
        }
      }

      :host([small]) {
        #fullscreen,
        #menu,
        #replay {
          width: 20px;
          height: 20px;

          & .g-icon {
            font-size: 20px;
          }
        }
      }

      #progress-container {
        flex: 1 1 auto;
        margin: 0 var(--bb-grid-size-6);
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        > #progress {
          width: 100%;
          max-width: 260px;
          height: 4px;
          background: light-dark(var(--s-80), var(--p-10));
          outline: 1px solid light-dark(var(--s-80), var(--p-10));
          border-radius: var(--bb-grid-size-16);
          position: relative;

          &::before {
            content: "";
            position: absolute;
            top: 0px;
            left: 0px;
            width: calc(var(--progress) * 100%);
            min-width: 4px;
            max-width: 100%;
            height: 4px;
            background: light-dark(var(--p-30), var(--p-80));
            border-radius: var(--bb-grid-size-16);
            transition: width 0.3s cubic-bezier(0, 0, 0.3, 1);
          }
        }
      }

      :host([isempty]) #progress-container > #progress,
      :host([neutral]) #progress-container > #progress {
        background: light-dark(var(--original-n-80), var(--original-n-0));
        outline: 1px solid light-dark(var(--original-n-80), var(--original-n-0));

        &::before {
          background: light-dark(var(--original-n-30), var(--original-n-80));
        }
      }

      :host([isempty]) #fullscreen,
      :host([isempty]) #menu,
      :host([isempty]) #replay,
      :host([isempty]) #replay-autostart {
        color: light-dark(
          oklch(from var(--n-10) l c h / 38%),
          oklch(from var(--n-80) l c h / 38%)
        );
        pointer-events: none;
      }

      :host([isempty]) #progress-container {
        visibility: hidden;
      }

      ul {
        padding: 0;
        margin: 0;
        list-style: none;

        li {
          height: var(--bb-grid-size-13);
          display: flex;
          align-items: center;
          margin-right: var(--bb-grid-size-6);

          .g-icon {
            margin-right: var(--bb-grid-size-2);
          }
        }

        button,
        a {
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          height: var(--bb-grid-size-10);
          text-decoration: none;
          color: var(--light-dark-p-40, var(--light-dark-n-20));
          transition: color 0.2s cubic-bezier(0, 0, 0.3, 1);
          padding-left: var(--bb-grid-size-6);

          &:hover,
          &:focus {
            cursor: pointer;
            color: var(--light-dark-p-20, var(--light-dark-n-10));
          }

          > * {
            pointer-events: none;
          }

          .open-in-new {
            margin-left: var(--bb-grid-size-2);
          }
        }
      }
    `,
  ];

  constructor() {
    super();

    const showReplayWarning =
      globalThis.localStorage.getItem(REPLAY_WARNING_KEY);
    this.#showReplayWarning = showReplayWarning === null;
  }

  #renderFullScreen() {
    if (this.fullScreenActive === null || this.fullScreenActive === "no-exit") {
      return nothing;
    }

    return html`<button
      id="fullscreen"
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent(
            this.fullScreenActive === "available"
              ? "Expanded view"
              : "Exit Expanded view",
            evt.clientX,
            evt.clientY
          )
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        this.dispatchEvent(
          new StateEvent({
            eventType: "app.fullscreen",
            action:
              this.fullScreenActive === "available" ? "activate" : "deactivate",
          })
        );
      }}
    >
      <span class="g-icon"
        >${this.fullScreenActive === "active" ? "close" : "fullscreen"}</span
      >
    </button>`;
  }

  #renderMenuButton() {
    return html`<button
      id="menu"
      ?disabled=${!this.menuActive}
      @click=${() => {
        if (!this.#sideNav) {
          return;
        }

        this.#sideNav.active = true;
      }}
    >
      <span class="g-icon">menu</span>
    </button>`;
  }

  #renderProgress() {
    return html`<div id="progress-container">
      <div
        id="progress"
        style=${styleMap({ "--progress": this.progress })}
      ></div>
    </div>`;
  }

  #renderReplayAutoStartButton() {
    return html`<button
      id="replay-autostart"
      class="w-500 round sans-flex md-body-small"
      ?disabled=${!this.replayActive}
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent("Run all steps", evt.clientX, evt.clientY)
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        this.dispatchEvent(new HideTooltipEvent());
        if (this.running) {
          this.dispatchEvent(new StateEvent({ eventType: "board.stop" }));
        } else {
          this.dispatchEvent(new StateEvent({ eventType: "board.restart" }));
        }
      }}
    >
      <span class="g-icon">spark</span> ${this.running ? "Stop" : "Start"}
    </button>`;
  }

  #renderReplayButton(stackRight = false) {
    const showReplayWarning = this.progress > 0 && this.#showReplayWarning;

    return html`<button
      id="replay"
      ?disabled=${!this.replayActive}
      @pointerover=${(evt: PointerEvent) => {
      if (showReplayWarning || this.isEmpty) {
          return;
        }
        this.dispatchEvent(
          new ShowTooltipEvent("Restart app", evt.clientX, evt.clientY)
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        this.dispatchEvent(new StateEvent({ eventType: "board.stop" }));
      }}
    >
      <span class="g-icon">replay</span>
      ${showReplayWarning
        ? html`<bb-onboarding-tooltip
            delayed
            ?stackRight=${stackRight}
            .tooltipTitle=${"Are you sure you want to refresh?"}
            .text=${"Share or download results, otherwise output will be lost."}
            @bbonboardingacknowledged=${() => {
              globalThis.localStorage.setItem(REPLAY_WARNING_KEY, "false");
              this.#showReplayWarning = false;
            }}
          ></bb-onboarding-tooltip>`
        : nothing}
    </button>`;
  }

  #renderSideNav() {
    return html`<bb-sidenav
      id="side-nav"
      @bboverlaydismissed=${() => {
        if (!this.#sideNav) {
          return;
        }

        this.#sideNav.active = false;
      }}
      >${this.appTitle
        ? html`<h1 class="md-headline-small sans-flex round" slot="title">
            ${this.appTitle}
          </h1>`
        : nothing}

      <ul slot="bottom">
        <li>
          <a
            href="https://policies.google.com/"
            class="w-400 round md-title-medium"
            ><span class="g-icon filled round w-500">shield_person</span>Privacy
            & Terms<span class="g-icon filled round w-500 open-in-new"
              >open_in_new</span
            ></a
          >
        </li>
        <li>
          <a href="/" class="w-400 round md-title-medium"
            ><span class="g-icon filled round w-500">gallery_thumbnail</span
            >View more ${Strings.from("APP_NAME")} apps<span
              class="g-icon filled round w-500 open-in-new"
              >open_in_new</span
            ></a
          >
        </li>
      </ul>
    </bb-sidenav>`;
  }

  render() {
    const replay = this.replayAutoStart
      ? this.#renderReplayAutoStartButton()
      : this.#renderReplayButton(this.fullScreenActive !== null);

    if (this.fullScreenActive !== null) {
      return [replay, this.#renderProgress(), this.#renderFullScreen()];
    }

    return [
      this.#renderMenuButton(),
      this.#renderProgress(),
      replay,
      this.#renderSideNav(),
    ];
  }
}
