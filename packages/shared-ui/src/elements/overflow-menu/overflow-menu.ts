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
import { OverflowAction } from "../../types/types.js";

@customElement("bb-overflow-menu")
export class OverflowMenu extends LitElement {
  @property()
  accessor actions: OverflowAction[] = [];

  @property()
  accessor disabled = true;

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
      background: var(--background-color, var(--bb-neutral-0));
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      z-index: 2;
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      max-height: 380px;
      scrollbar-width: none;
      overflow-y: scroll;
    }

    button {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4) var(--bb-grid-size-3)
        var(--bb-grid-size-11);
      color: var(--text-color, var(--bb-neutral-900));
      background: transparent var(--bb-icon-public) 12px center / 20px 20px
        no-repeat;
      border: none;
      text-align: left;
      cursor: pointer;
      min-width: 130px;
      width: 100%;
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.5;
      cursor: auto;

      &:not([disabled]) {
        opacity: 1;
        cursor: pointer;

        &:hover,
        &:focus {
          background-color: oklch(
            from var(--text-color, var(--bb-neutral-900)) l c h /
              calc(alpha - 0.9)
          );
        }
      }

      &.share {
        background-image: var(--bb-icon-share);
      }

      &.copy {
        background-image: var(--bb-icon-copy-to-clipboard);
      }

      &.download {
        background-image: var(--bb-icon-download);
      }

      &.save {
        background-image: var(--bb-icon-save);
      }

      &.save-as {
        background-image: var(--bb-icon-save-as);
      }

      &.settings {
        background-image: var(--bb-icon-settings);
      }

      &.delete {
        background-image: var(--bb-icon-delete);
      }

      &.preview {
        background-image: var(--bb-icon-preview);
      }

      &.edit {
        background-image: var(--bb-icon-edit);
      }

      &.fit {
        background-image: var(--bb-icon-fit);
      }

      &.undo {
        background-image: var(--bb-icon-undo);
      }

      &.redo {
        background-image: var(--bb-icon-redo);
      }

      &.zoom-to-fit {
        background-image: var(--bb-icon-fit);
      }

      &.reset-nodes {
        background-image: var(--bb-icon-reset-nodes);
      }

      &.edit-board-details {
        background-image: var(--bb-icon-data-info-alert);
      }

      &.board {
        background-image: var(--bb-icon-board);
      }

      &.add-circle {
        background-image: var(--bb-icon-add-circle);
      }

      &.module {
        background-image: var(--bb-icon-extension);
      }

      &.module-ts {
        background-image: var(--bb-icon-extension-ts);
      }

      &.duplicate {
        background-image: var(--bb-icon-duplicate);
      }

      &.quick-jump {
        background-image: var(--bb-icon-quick-jump);
      }

      &.maximize {
        background-image: var(--bb-icon-maximize);
      }

      &.minimize {
        background-image: var(--bb-icon-minimize);
      }

      &.checked {
        background-image: var(--bb-icon-check);
      }

      &.unchecked {
        background-image: var(--bb-icon-check);
      }

      &.logout {
        background-image: var(--bb-icon-logout);
      }

      &.upload {
        background-image: var(--bb-icon-upload);
      }

      &.content-add {
        background-image: var(--bb-icon-text);
      }

      &.youtube {
        background-image: var(--bb-icon-youtube);
      }

      &.gdrive {
        background-image: var(--bb-icon-google-drive-outline);
      }

      &.drawable {
        background-image: var(--bb-icon-add-drawable);
      }

      &.flow {
        background-image: var(--bb-icon-flowchart);
      }

      &.step {
        background-image: var(--bb-icon-step);
      }

      &.code {
        background-image: var(--bb-icon-code);
      }

      &.error {
        background-image: var(--bb-icon-error);
        color: var(--bb-warning-600);
      }
    }

    div {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--bb-neutral-100);
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
      border-radius: var(--bb-grid-size);
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
          @click=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new OverflowMenuActionEvent(
                action.name,
                action.value ?? null,
                evt.clientX,
                evt.clientY
              )
            );
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
