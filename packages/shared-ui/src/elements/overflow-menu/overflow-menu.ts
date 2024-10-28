/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import {
  OverflowMenuActionEvent,
  OverflowMenuDismissedEvent,
  OverflowMenuSecondaryActionEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";

interface Action {
  title: string;
  name: string;
  icon: string;
  disabled?: boolean;
  secondaryAction?: string;
}

@customElement("bb-overflow-menu")
export class OverflowMenu extends LitElement {
  @property()
  actions: Action[] = [];

  @property()
  disabled = true;

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: grid;
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ffffff;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      z-index: 2;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
    }

    button {
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4) var(--bb-grid-size-3)
        var(--bb-grid-size-11);
      color: var(--bb-neutral-900);
      background: transparent var(--bb-icon-public) 12px center / 20px 20px
        no-repeat;
      border: none;
      text-align: left;
      cursor: pointer;
      min-width: 130px;
      width: 100%;
    }

    div {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--bb-neutral-300);
    }

    div:last-of-type {
      border-bottom: none;
    }

    .secondary-action {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      margin: 0 var(--bb-grid-size);
      background: transparent;
      background-position: center center;
      background-repeat: no-repeat;
      padding: 0;
      border: none;
      min-width: 20px;
      border-radius: 0;
    }

    div:first-of-type:not(.with-secondary-action) button {
      border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
    }

    div:last-of-type:not(.with-secondary-action) button {
      border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);
    }

    div.with-secondary-action:first-of-type button:first-child {
      border-radius: var(--bb-grid-size-2) 0 0 0;
    }

    div.with-secondary-action:last-of-type button:first-child {
      border-radius: 0 0 0 var(--bb-grid-size-2);
    }

    div:only-child button {
      border-radius: var(--bb-grid-size-2);
    }

    button[disabled] {
      opacity: 0.5;
      cursor: auto;
    }

    button:not([disabled]):hover,
    button:not([disabled]):focus {
      background-color: var(--bb-neutral-50);
    }

    button.copy {
      background-image: var(--bb-icon-copy-to-clipboard);
    }

    button.download {
      background-image: var(--bb-icon-download);
    }

    button.save {
      background-image: var(--bb-icon-save);
    }

    button.save-as {
      background-image: var(--bb-icon-save-as);
    }

    button.settings {
      background-image: var(--bb-icon-settings);
    }

    button.delete {
      background-image: var(--bb-icon-delete);
    }

    button.preview {
      background-image: var(--bb-icon-preview);
    }

    button.edit {
      background-image: var(--bb-icon-edit);
    }

    button.undo {
      background-image: var(--bb-icon-undo);
    }

    button.redo {
      background-image: var(--bb-icon-redo);
    }

    button.zoom-to-fit {
      background-image: var(--bb-icon-fit);
    }

    button.reset-nodes {
      background-image: var(--bb-icon-reset-nodes);
    }

    button.edit-board-details {
      background-image: var(--bb-icon-data-info-alert);
    }

    button.board {
      background-image: var(--bb-icon-board);
    }

    button.add-circle {
      background-image: var(--bb-icon-add-circle);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("pointerdown", this.#onPointerDownBound);
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected firstUpdated(): void {
    window.addEventListener("pointerdown", this.#onPointerDownBound);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.dispatchEvent(new OverflowMenuDismissedEvent());
  }

  #onPointerDown(evt: Event): void {
    const path = evt.composedPath();
    if (path.includes(this)) {
      return;
    }

    this.dispatchEvent(new OverflowMenuDismissedEvent());
  }

  render() {
    return html`${map(this.actions, (action) => {
      return html`<div
        class=${classMap({
          ["with-secondary-action"]: action.secondaryAction !== undefined,
        })}
      >
        <button
          class=${classMap({ [action.icon]: true })}
          @click=${() => {
            this.dispatchEvent(new OverflowMenuActionEvent(action.name));
          }}
          ?disabled=${(action.name !== "settings" && this.disabled) ||
          action.disabled}
        >
          ${action.title}
        </button>

        ${action.secondaryAction
          ? html`<button
              @click=${() => {
                if (!action.secondaryAction) {
                  return;
                }
                this.dispatchEvent(
                  new OverflowMenuSecondaryActionEvent(
                    action.secondaryAction,
                    action.name
                  )
                );
              }}
              ?disabled=${(action.name !== "settings" && this.disabled) ||
              action.disabled}
              class=${classMap({
                "secondary-action": true,
                [action.secondaryAction]: true,
              })}
            ></button>`
          : nothing}
      </div>`;
    })}`;
  }
}
