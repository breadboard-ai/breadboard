/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { OverflowAction } from "../../../types/types.js";
import { notebookLmIcon } from "../../../styles/svg-icons.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  AddAssetRequestEvent,
  OverflowMenuActionEvent,
} from "../../../events/events.js";
import { icons } from "../../../styles/icons.js";

const BUTTON_HEIGHT = 44;

@customElement("bb-add-asset-button")
export class AddAssetButton extends LitElement {
  @property({ type: Boolean })
  accessor disabled = false;

  @property()
  accessor showGDrive = false;

  @property()
  accessor showNotebookLm = false;

  @property()
  accessor supportedActions = {
    upload: true,
    youtube: true,
    drawable: true,
    gdrive: true,
    webcamVideo: true,
    notebooklm: true,
  };

  @property()
  accessor allowedUploadMimeTypes: string | null = null;

  @property()
  accessor anchor: "above" | "below" = "below";

  @state()
  accessor _showOverflowMenu = false;

  @state()
  accessor _assetType = "file";

  static styles = [
    icons,
    css`
      :host {
        display: flex;
        align-items: flex-end;
        position: relative;
        width: var(--button-size, 40px);
        height: var(--button-size, 40px);
      }

      #add-asset {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--button-size, 40px);
        height: var(--button-size, 40px);
        border: none;
        background: var(
          --background-color,
          var(--light-dark-n-90, var(--light-dark-n-90))
        );
        color: var(
          --text-color,
          var(--light-dark-p-40, var(--light-dark-n-20))
        );
        flex: 0 0 auto;
        border-radius: var(--button-border-radius, 50%);
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        opacity: 0.8;

        * {
          pointer-events: none;
        }

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            opacity: 1;
          }
        }
      }

      bb-overflow-menu {
        position: absolute;
        top: 0;
        left: 0;
        width: min-content;
        --border-color: transparent;
        --inner-border-color: light-dark(var(--n-90), var(--n-30));
        --background-color: light-dark(var(--p-98), var(--n-20));
        --text-color: light-dark(var(--n-30), var(--nv-95));
      }
    `,
  ];

  #overflowMenu: { x: number; y: number } = { x: 0, y: 0 };

  render() {
    let overflowMenu: HTMLTemplateResult | symbol = nothing;
    const overflowMenuPosition = { ...this.#overflowMenu };
    if (this._showOverflowMenu) {
      const actions: OverflowAction[] = [];

      if (this.supportedActions.upload) {
        actions.push({
          icon: "upload",
          name: "upload",
          title: "Upload from Device",
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

      if (this.supportedActions.webcamVideo) {
        actions.push({
          icon: "videocam",
          name: "webcam-video",
          title: "Add a Webcam Video",
        });
      }

      if (this.supportedActions.notebooklm && this.showNotebookLm) {
        actions.push({
          icon: notebookLmIcon,
          name: "notebooklm",
          title: "NotebookLM",
        });
      }

      if (this.anchor === "above") {
        overflowMenuPosition.y -= 12; // Clearance.
        overflowMenuPosition.y -= actions.length * BUTTON_HEIGHT; // Menu height.
      }

      overflowMenu = html`<bb-overflow-menu
        style=${styleMap({
          left: `${overflowMenuPosition.x}px`,
          top: `${overflowMenuPosition.y}px`,
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

          this.#overflowMenu.x = 0;
          this.#overflowMenu.y = 0;

          this._showOverflowMenu = true;
        }}
        id="add-asset"
      >
        <span class="g-icon">add_circle</span>
      </button>
      ${overflowMenu}`;
  }
}
