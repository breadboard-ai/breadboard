/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { OverflowAction } from "../../../types/types.js";
import { notebookLmIcon } from "../../../styles/svg-icons.js";
import {
  AddAssetRequestEvent,
  ShowOverflowMenuEvent,
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
    `,
  ];

  render() {
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

    return html`<button
      ?disabled=${this.disabled}
      @click=${(evt: Event) => {
        if (!(evt.target instanceof HTMLButtonElement)) {
          return;
        }

        const bounds = evt.target.getBoundingClientRect();
        const x = bounds.left;
        let y = bounds.bottom;

        if (this.anchor === "above") {
          y = bounds.top - 12 - actions.length * BUTTON_HEIGHT;
        }

        this.dispatchEvent(
          new ShowOverflowMenuEvent(actions, x, y, (action) => {
            this.dispatchEvent(
              new AddAssetRequestEvent(action, this.allowedUploadMimeTypes)
            );
          })
        );
      }}
      id="add-asset"
    >
      <span class="g-icon">add_circle</span>
    </button>`;
  }
}
