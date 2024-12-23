/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { ReactiveAppState } from "../state/app.js";
import type { ReactiveSessionBriefState } from "../state/session-brief.js";
import type { SessionStore } from "../state/session-store.js";

@customElement("bbrt-session-picker")
export class BBRTSesssionPicker extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor appState: ReactiveAppState | undefined = undefined;

  @property({ attribute: false })
  accessor sessionStore: SessionStore | undefined = undefined;

  static override styles = css`
    :host {
      display: block;
      padding: 24px;
      font-family: Helvetica, sans-serif;
    }
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    li {
      margin: 0.2em 0;
    }
    a {
      text-decoration: none;
      color: #6c80a0;
      font-size: 0.85em;
    }
    .active > a {
      color: #008dff;
    }
    a:hover,
    .active > a:hover {
      color: #52e5ad;
      cursor: pointer;
    }
    :first-child {
      margin-top: 0;
    }
    img {
      height: 16px;
      max-width: 16px;
    }
  `;

  override render() {
    if (!this.appState) {
      return nothing;
    }
    const sessions = Object.values(this.appState.sessions).map((session) =>
      this.#renderSession(session)
    );
    return html`
      <button @click=${this.#clickNewSessionButton}>New Session</button>
      <ul>
        ${sessions}
      </ul>
    `;
  }

  #renderSession({ id, title }: ReactiveSessionBriefState) {
    return html`
      <li class=${classMap({ active: this.appState?.activeSessionId === id })}>
        <a @click=${(event: MouseEvent) => this.#clickSessionLink(event, id)}
          >${title}</a
        >
        <button
          @click=${(event: MouseEvent) =>
            this.#clickDeleteSessionButton(event, id)}
        >
          X
        </button>
      </li>
    `;
  }

  #clickNewSessionButton(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const appState = this.appState;
    if (appState && this.sessionStore) {
      const brief = appState.createSessionBrief();
      this.sessionStore.createSession(brief).then((result) => {
        if (result.ok) {
          appState.activeSessionId = brief.id;
        } else {
          // TODO(aomarks) Show an error.
          console.error(`Failed to create session: ${result.error}`);
        }
      });
    }
  }

  #clickSessionLink(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    event.stopImmediatePropagation();
    // TODO(aomarks) Make this a real hyperlink, syncronize session via hash.
    if (this.appState) {
      this.appState.activeSessionId = sessionId;
    }
  }

  #clickDeleteSessionButton(event: MouseEvent, sessionId: string) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.appState && this.sessionStore) {
      if (this.appState.activeSessionId === sessionId) {
        this.appState.activeSessionId = null;
      }
      this.appState.sessionMap.delete(sessionId);
      this.sessionStore.deleteSession(sessionId);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-session-picker": BBRTSesssionPicker;
  }
}
