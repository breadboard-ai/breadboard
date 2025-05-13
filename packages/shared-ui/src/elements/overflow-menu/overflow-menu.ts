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
import { icons } from "../../styles/icons.js";

@customElement("bb-overflow-menu")
export class OverflowMenu extends LitElement {
  @property()
  accessor actions: OverflowAction[] = [];

  @property()
  accessor disabled = true;

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);

  static styles = [
    icons,
    css`
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
        display: flex;
        align-items: center;

        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4)
          var(--bb-grid-size-3) var(--bb-grid-size-3);
        color: var(--text-color, var(--bb-neutral-900));
        background: transparent;
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

        &:not(.secondary-action) .g-icon {
          margin-right: var(--bb-grid-size-2);
        }

        &.flag .g-icon::before {
          content: "flag";
        }

        &.share .g-icon::before {
          content: "share";
        }

        &.copy .g-icon::before {
          content: "content_copy";
        }

        &.download .g-icon::before {
          content: "download";
        }

        &.save .g-icon::before {
          content: "save";
        }

        &.save-as .g-icon::before {
          content: "save";
        }

        &.settings .g-icon::before {
          content: "settings";
        }

        &.delete .g-icon::before {
          content: "delete";
        }

        &.preview .g-icon::before {
          content: "preview";
        }

        &.edit .g-icon::before {
          content: "edit";
        }

        &.fit .g-icon::before {
          content: "fit_screen";
        }

        &.undo .g-icon::before {
          content: "undo";
        }

        &.redo .g-icon::before {
          content: "redo";
        }

        &.zoom-to-fit .g-icon::before {
          content: "fit_screen";
        }

        &.reset-nodes .g-icon::before {
          content: "replay";
        }

        &.edit-board-details .g-icon::before {
          content: "data_info_alert";
        }

        &.board .g-icon::before {
          content: "developer_board";
        }

        &.add-circle .g-icon::before {
          content: "add_circle";
        }

        &.module .g-icon::before {
          content: "extension";
        }

        &.module-ts .g-icon::before {
          content: "extension";
        }

        &.duplicate .g-icon::before {
          content: "tab_inactive";
        }

        &.quick-jump .g-icon::before {
          content: "arrow_circle_right";
        }

        &.maximize .g-icon::before {
          content: "expand_content";
        }

        &.minimize .g-icon::before {
          content: "collapse_content";
        }

        &.checked .g-icon::before {
          content: "check";
        }

        &.unchecked .g-icon::before {
          content: "check";
        }

        &.logout .g-icon::before {
          content: "logout";
        }

        &.upload .g-icon::before {
          content: "upload";
        }

        &.content-add .g-icon::before {
          content: "text_fields";
        }

        &.youtube .g-icon::before {
          content: "video_youtube";
        }

        &.gdrive .g-icon::before {
          content: "drive";
        }

        &.drawable .g-icon::before {
          content: "draw";
        }

        &.flow .g-icon::before {
          content: "flowchart";
        }

        &.step .g-icon::before {
          content: "step";
        }

        &.code .g-icon::before {
          content: "code";
        }

        &.remix .g-icon::before {
          content: "call_split";
        }

        &.error .g-icon::before {
          content: "error";
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
    `,
  ];

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
          <span class="g-icon"></span>
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
            >
              <span class="g-icon"></span>
            </button>`
          : nothing}
      </div>`;
    })}`;
  }
}
