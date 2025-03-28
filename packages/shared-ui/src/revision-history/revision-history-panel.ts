/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../styles/icons.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { EditHistory, EditHistoryEntry } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import {
  SigninAdapter,
  signinAdapterContext,
} from "../utils/signin-adapter.js";

@customElement("bb-revision-history-panel")
export class RevisionHistoryPanel extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-family: "Google Sans", sans-serif;
        height: 100%;
        overflow-y: auto;
        padding: 16px;
      }

      #wip-msg {
        text-align: center;
        background: #ffb61554;
        border-radius: 12px;
        padding: 12px 16px;
        margin: 0;
        font-size: 14px;
        line-height: 1.5em;
      }

      #no-history-msg {
        margin: auto;
        margin-top: 24px;
        color: var(--bb-neutral-500, currentColor);
        display: flex;
        & > .g-icon {
          margin-right: 8px;
          animation: spin 1.5s linear infinite;
        }
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      #revisions {
        margin: 0;
        padding: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .revision {
        cursor: pointer;
        list-style-type: none;
        display: flex;
        flex-direction: column;
        padding: 12px 16px;
        border-radius: 12px;
        gap: 8px;
        &.displayed {
          background: var(--bb-neutral-50);
          cursor: initial;
        }
        &:not(.displayed) {
          &:hover,
          &:focus {
            background: var(--bb-neutral-100);
          }
        }
      }
      .date {
        font-size: 14px;
        font-weight: 500;
      }
      .current {
        font-size: 12px;
        font-style: italic;
      }
      .label {
        font-size: 12px;
      }
      .creator {
        display: flex;
        align-items: center;
        font-size: 12px;
        & > .icon {
          &.placeholder {
            margin: 0 4px 0 -3px;
          }
          &.signedin {
            width: 16px;
            aspect-ratio: 1;
            border-radius: 50%;
            margin-right: 8px;
          }
        }
      }
    `,
  ];

  @consume({ context: signinAdapterContext })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @property({ attribute: false })
  accessor history: EditHistory | undefined | null = undefined;

  override render() {
    const history = this.history;
    if (!history) {
      return html`
        <p id="no-history-msg">
          <span class="g-icon">progress_activity</span>
          Waiting for history ...
        </p>
      `;
    }
    const rows = [];
    const pending = history.pending;
    if (pending) {
      rows.push(this.#renderRevision(pending, true, true));
    }
    const committed = history.entries();
    for (
      // When we roll back and then add an edit, the history array's length
      // won't reflect the truncation until the pending entry is committed.
      let i = pending ? history.index() : committed.length - 1;
      i >= 0;
      i--
    ) {
      const isCurrent = !pending && i === committed.length - 1;
      const isDisplayed = !pending && i === history.index();
      rows.push(
        this.#renderRevision(
          committed[i],
          isCurrent,
          isDisplayed,
          isDisplayed ? undefined : () => history.jump(i)
        )
      );
    }
    return html`
      <p id="wip-msg">
        Revision history is a work in progress with known bugs.
      </p>
      <ul id="revisions">
        ${rows}
      </ul>
    `;
  }

  #renderRevision(
    revision: EditHistoryEntry,
    isCurrent: boolean,
    isDisplayed: boolean,
    selectRevisionFn?: () => void
  ) {
    const formattedDate = new Date(revision.timestamp)
      .toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
      .replace(" at ", ", ");
    return html`
      <li
        class=${classMap({ revision: true, displayed: isDisplayed })}
        tabindex="0"
        role="button"
        @click=${selectRevisionFn}
        @keydown=${selectRevisionFn &&
        (({ key }: KeyboardEvent) => key === "Enter" && selectRevisionFn())}
      >
        <span class="date">${formattedDate}</span>
        ${isCurrent
          ? html`<span class="current">Current version</span>`
          : nothing}
        <span class="label">${revision.label}</span>
        <span class="creator">
          ${this.signinAdapter?.picture
            ? html`
                <img
                  class="icon signedin"
                  crossorigin="anonymous"
                  src=${this.signinAdapter.picture}
                />
              `
            : html`
                <span class="icon placeholder g-icon filled">person</span>
              `}
          <span class="name"
            >${this.signinAdapter?.name ?? "Unknown User"}</span
          >
        </span>
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-revision-history-panel": RevisionHistoryPanel;
  }
}
