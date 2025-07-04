/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { icons } from "../../../styles/icons";
import { styleMap } from "lit/directives/style-map.js";
import { SideNav } from "./side-nav";
import { type } from "../../../styles/host/type";

import "./side-nav.js";
import { StateEvent } from "../../../events/events.js";

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
  accessor appTitle: string | null = null;

  @property()
  accessor appURL: string | null = null;

  @query("#side-nav")
  accessor #sideNav: SideNav | null = null;

  static styles = [
    icons,
    type,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 54px;
        border-bottom: 1px solid var(--s-70, var(--bb-neutral-100));
        padding: 0 var(--bb-grid-size-4);
        position: relative;
        flex: 0 0 auto;
        z-index: 2;
        color: var(--p-40, var(--bb-neutral-900));
      }

      :host([neutral]) {
        border-top: 1px solid var(--n-95);
        border-bottom: 1px solid var(--n-90);
      }

      #menu,
      #replay {
        width: 20px;
        height: 20px;
        background: transparent;
        border: none;
        font-size: 20px;
        opacity: 0.6;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        padding: 0;
        color: var(--p-15, var(--bb-neutral-800));
        border-radius: 50%;

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            opacity: 1;
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
          max-width: 320px;
          height: 4px;
          background: var(--n-100, var(--bb-neutral-200));
          outline: 1px solid var(--n-100);
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
            background: var(--p-40, var(--bb-neutral-600));
            border-radius: var(--bb-grid-size-16);
            transition: width 0.3s cubic-bezier(0, 0, 0.3, 1);
          }
        }
      }

      :host([neutral]) #progress-container > #progress {
        background: var(--s-80, var(--bb-neutral-200));
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
          color: var(--p-40, var(--bb-neutral-800));
          transition: color 0.2s cubic-bezier(0, 0, 0.3, 1);
          padding-left: var(--bb-grid-size-6);

          &:hover,
          &:focus {
            cursor: pointer;
            color: var(--p-20, var(--bb-neutral-900));
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

  render() {
    return html` <button
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
      </button>

      <div id="progress-container">
        <div
          id="progress"
          style=${styleMap({ "--progress": this.progress })}
        ></div>
      </div>

      <button
        id="replay"
        ?disabled=${!this.replayActive}
        @click=${() => {
          this.dispatchEvent(
            new StateEvent({
              eventType: "board.stop",
              clearLastRun: true,
            })
          );
        }}
      >
        <span class="g-icon">replay</span>
      </button>
      <bb-sidenav
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
            <a href="/policy" class="w-400 round md-title-medium"
              ><span class="g-icon filled round w-500">shield_person</span
              >Privacy & Terms<span
                class="g-icon filled round w-500 open-in-new"
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
}
