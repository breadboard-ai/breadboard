/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import {
  OverflowMenuActionEvent,
  OverflowMenuDismissedEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";

interface Action {
  title: string;
  name: string;
  icon: string;
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
      padding: var(--bb-grid-size-3);
      padding-left: var(--bb-grid-size-11);
      color: var(--bb-neutral-900);
      background: transparent var(--bb-icon-public) 12px center / 20px 20px
        no-repeat;
      border: none;
      text-align: left;
      border-bottom: 1px solid var(--bb-neutral-300);
      cursor: pointer;
    }

    button:first-of-type {
      border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
    }

    button:last-of-type {
      border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);
      border-bottom: none;
    }

    button[disabled] {
      opacity: 0.5;
      cursor: auto;
    }

    button:not([disabled]):hover,
    button:not([disabled]):focus {
      background-color: var(--bb-neutral-50);
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
      return html`<button
        class=${classMap({ [action.icon]: true })}
        @click=${() => {
          this.dispatchEvent(new OverflowMenuActionEvent(action.name));
        }}
        ?disabled=${this.disabled}
      >
        ${action.title}
      </button>`;
    })}`;
  }
}
