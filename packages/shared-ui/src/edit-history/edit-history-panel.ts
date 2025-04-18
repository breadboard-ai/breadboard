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
import type {
  EditHistory,
  EditHistoryCreator,
  EditHistoryEntry,
  GraphDescriptor,
} from "@google-labs/breadboard";
import { consume } from "@lit/context";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../utils/signin-adapter.js";
import type { HighlightStateWithChangeId } from "../types/types.js";
import { findChangedNodes } from "../flow-gen/flow-diff.js";
import { HighlightEvent } from "../elements/step-editor/events/events.js";
import { MAIN_BOARD_ID } from "../constants/constants.js";
import { spinAnimationStyles } from "../styles/spin-animation.js";

@customElement("bb-edit-history-panel")
export class EditHistoryPanel extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    spinAnimationStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
        font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        height: 100%;
        overflow-y: auto;
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

      #revisions {
        margin: 0;
        padding: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-2);
      }

      .revision {
        list-style-type: none;
        display: flex;
        align-items: center;
        padding: var(--bb-grid-size) var(--bb-grid-size-3);
        border-radius: 12px;
        min-height: 37.5px;
        box-sizing: border-box;
        gap: 8px;
        border: 1px solid transparent;
        &:not(.displayed) {
          cursor: pointer;
          background: transparent;
          &:hover,
          &:focus {
            background: var(--bb-neutral-100);
          }
          &.current {
            &:hover,
            &:focus {
              background: #d9f1d4;
            }
          }
        }
        &.displayed {
          cursor: initial;
          background: var(--bb-neutral-50);
        }
        &.current {
          background: #e9f7e6;
          border-color: #6ccb55;
        }
      }

      .icon {
        display: flex;
        > * {
          &.signed-in {
            border-radius: 50%;
            width: 16px;
            height: 16px;
          }
          &.g-icon {
            font-size: 22px;
            margin: 0 -4px 0 -3px;
          }
          &.assistant {
            color: var(--bb-generative-600);
          }
        }
      }

      .date {
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        margin-left: var(--bb-grid-size);
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
    const listItems = [];
    const pending = history.pending;
    if (pending) {
      listItems.push(this.#renderRevision(pending, true, true));
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
      const revision = committed[i];
      listItems.push(
        this.#renderRevision(revision, isCurrent, isDisplayed, () =>
          history.jump(i)
        )
      );
    }
    return html`
      <ul id="revisions">
        ${listItems}
      </ul>
    `;
  }

  override updated() {
    if (!this.history) {
      return;
    }
    let current: EditHistoryEntry;
    let previous: EditHistoryEntry | undefined;
    const revisions = this.history.entries();
    if (this.history.pending) {
      current = this.history.pending;
      previous = revisions.at(-1);
    } else {
      current = revisions[this.history.index()];
      previous = revisions[this.history.index() - 1];
    }
    const highlights = findHighlights(
      current,
      previous?.graph ?? { nodes: [], edges: [] }
    );
    this.dispatchEvent(new HighlightEvent(highlights));
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (
      this.history &&
      this.history.entries().length > 0 &&
      !this.history.pending
    ) {
      this.history.jump(this.history.entries().length - 1);
    }
    this.dispatchEvent(new HighlightEvent(null));
  }

  #renderRevision(
    edit: EditHistoryEntry,
    isCurrent: boolean,
    isDisplayed: boolean,
    selectRevisionFn?: () => void
  ) {
    const formattedDate = new Date(edit.timestamp)
      .toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
      .replace(" at ", ", ");
    const instruction = this.#extractGenerativeInstruction(edit);
    const title =
      `${edit.label} by ${this.#creatorName(edit.creator)}` +
      (instruction ? ` with instruction ${JSON.stringify(instruction)}` : "");
    return html`
      <li
        class=${classMap({
          revision: true,
          [`role-${edit.creator.role}`]: true,
          displayed: isDisplayed,
          current: isCurrent,
        })}
        tabindex="0"
        role="button"
        title=${title}
        @click=${selectRevisionFn}
        @keydown=${selectRevisionFn &&
        (({ key }: KeyboardEvent) => key === "Enter" && selectRevisionFn())}
      >
        <span class="icon">${this.#creatorIcon(edit.creator)}</span>
        <span class="date">${formattedDate}</span>
      </li>
    `;
  }

  #extractGenerativeInstruction(edit: EditHistoryEntry) {
    if (edit.creator.role !== "assistant") {
      return "";
    }
    const { metadata } = edit.graph;
    if (metadata?.revision_intents?.length) {
      return metadata.revision_intents.at(-1);
    }
    return metadata?.intent;
  }

  #creatorIcon(creator: EditHistoryCreator) {
    switch (creator.role) {
      // TODO(aomarks) Don't assume "unknown" is the current user after updating
      // all change events to be explicit about creator.
      case "user":
      case "unknown": {
        return this.signinAdapter?.picture
          ? html`
              <img
                class="signed-in"
                crossorigin="anonymous"
                src=${this.signinAdapter.picture}
              />
            `
          : html`<span class="g-icon filled placeholder">person</span>`;
      }
      case "assistant": {
        return html`<span class="g-icon filled assistant">spark</span>`;
      }
      default: {
        console.error(`Unexpected creator`, creator satisfies never);
        return html`
          <span class="g-icon filled placeholder">question_mark</span>
        `;
      }
    }
  }

  #creatorName(creator: EditHistoryCreator) {
    switch (creator.role) {
      // TODO(aomarks) Don't assume "unknown" is the current user after updating
      // all change events to be explicit about creator.
      case "user":
      case "unknown": {
        return this.signinAdapter?.name ?? "Unknown User";
      }
      case "assistant": {
        return "Assistant";
      }
      default: {
        console.error(`Unexpected creator`, creator satisfies never);
        return "Unknown";
      }
    }
  }
}

function findHighlights(
  revision: EditHistoryEntry,
  previous: GraphDescriptor
): HighlightStateWithChangeId {
  return {
    highlightChangeId: crypto.randomUUID(),
    highlightType:
      revision.creator.role === "user"
        ? "user"
        : revision.creator.role === "assistant"
          ? "model"
          : "user",
    highlightState: {
      graphs: new Map([
        [
          MAIN_BOARD_ID,
          {
            nodes: findChangedNodes(previous, revision.graph),
            // TODO(aomarks) Add changed edges.
            edges: new Set(),
            comments: new Set(),
          },
        ],
      ]),
    },
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-edit-history-panel": EditHistoryPanel;
  }
}
