/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { OverflowAction } from "../../../types/types";
import { styleMap } from "lit/directives/style-map.js";
import {
  AddAssetRequestEvent,
  OverflowMenuActionEvent,
} from "../../../events/events";

@customElement("bb-add-asset-button")
export class AddAssetButton extends LitElement {
  @property({ type: Boolean })
  accessor disabled = false;

  @property()
  accessor useGlobalPosition = true;

  @property()
  accessor showGDrive = false;

  @property()
  accessor supportedActions = {
    upload: true,
    youtube: true,
    drawable: true,
    gdrive: true,
  };

  @property()
  accessor allowedUploadMimeTypes: string | null = null;

  @property()
  accessor anchor: "above" | "below" = "below";

  @state()
  accessor _showOverflowMenu = false;

  @state()
  accessor _assetType = "file";

  static styles = css`
    :host {
      display: flex;
      align-items: flex-end;
    }

    #add-asset {
      width: var(--button-size, 40px);
      height: var(--button-size, 40px);
      border: none;
      background: oklch(
          from var(--primary-text-color) l c h / calc(alpha - 0.75)
        )
        var(--bb-icon-add) center center / 20px 20px no-repeat;
      flex: 0 0 auto;
      border-radius: var(--button-border-radius, 50%);
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      opacity: 0.5;

      &:not([disabled]) {
        cursor: pointer;

        &:focus,
        &:hover {
          opacity: 1;
        }
      }
    }

    bb-overflow-menu {
      position: fixed;
      top: 0;
      left: 0;
      width: min-content;
    }
  `;

  #overflowMenu: { x: number; y: number } = { x: 0, y: 0 };

  render() {
    let overflowMenu: HTMLTemplateResult | symbol = nothing;
    if (this._showOverflowMenu) {
      const actions: OverflowAction[] = [];

      if (this.supportedActions.upload) {
        actions.push({
          icon: "upload",
          name: "upload",
          title: "Upload from device",
        });
      }

      if (this.supportedActions.youtube) {
        actions.push({
          icon: "youtube",
          name: "youtube",
          title: "Add YouTube Video",
        });
      }

      if (this.supportedActions.gdrive && this.showGDrive) {
        actions.push({
          icon: "gdrive",
          title: "Add from Google Drive",
          name: "gdrive",
        });
      }

      if (this.supportedActions.drawable) {
        actions.push({
          icon: "drawable",
          name: "drawable",
          title: "Add a Drawing",
        });
      }

      if (this.anchor === "above") {
        this.#overflowMenu.y -= 40; // Button height.
        this.#overflowMenu.y -= 10; // Clearance.
        this.#overflowMenu.y -= Math.min(380, actions.length * 40); // Menu height.
      }

      overflowMenu = html`<bb-overflow-menu
        style=${styleMap({
          left: `${this.#overflowMenu.x}px`,
          top: `${this.#overflowMenu.y}px`,
        })}
        .actions=${actions}
        .disabled=${false}
        @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
          evt.stopImmediatePropagation();
          this._showOverflowMenu = false;

          this.dispatchEvent(
            new AddAssetRequestEvent(evt.action, this.allowedUploadMimeTypes)
          );
        }}
        @bboverflowmenudismissed=${() => {
          this._showOverflowMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    return html`<button
        ?disabled=${this.disabled}
        @click=${(evt: Event) => {
          if (!(evt.target instanceof HTMLButtonElement)) {
            return;
          }

          const bounds = evt.target.getBoundingClientRect();
          if (this.useGlobalPosition) {
            this.#overflowMenu.x = bounds.x;
            this.#overflowMenu.y = bounds.bottom + 10;
          } else {
            this.#overflowMenu.x = this.offsetLeft + evt.target.offsetLeft;
            this.#overflowMenu.y =
              this.offsetTop + evt.target.offsetTop + bounds.height;
          }

          this._showOverflowMenu = true;
        }}
        id="add-asset"
      >
        +
      </button>
      ${overflowMenu}`;
  }
}
