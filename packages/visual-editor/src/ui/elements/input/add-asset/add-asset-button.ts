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

  @property({ reflect: true })
  accessor label: string | null = null;

  @property({ reflect: true })
  accessor variant: "default" | "seamless" = "default";

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

      :host([label]:not([variant="seamless"])) {
        width: auto;
        height: auto;
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

      :host([label]:not([variant="seamless"])) #add-asset {
        width: auto;
        height: 36px;
        padding: 0 var(--bb-grid-size-4);
        border-radius: 18px;
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        background: var(--background-color, var(--light-dark-n-95));
        color: var(--text-color, var(--light-dark-n-30));
        opacity: 1;
        border: var(--button-border, 1px solid var(--light-dark-n-90));
      }

      :host([label]:not([variant="seamless"])) #add-asset:hover {
        background: var(--background-hover-color, var(--light-dark-n-90));
        color: var(--text-hover-color, var(--light-dark-n-10));
      }

      :host([label]:not([variant="seamless"])) #add-asset .g-icon {
        font-size: 18px;
      }

      :host([variant="seamless"]) {
        width: auto;
        height: auto;
      }

      :host([variant="seamless"]) #add-asset {
        background: transparent;
        border: none;
        padding: 0;
        width: auto;
        height: auto;
        color: var(--light-dark-n-30);
      }

      :host([variant="seamless"]) #add-asset:hover {
        background: transparent;
        color: var(--light-dark-n-10);
      }

      :host([variant="seamless"]) #add-asset .g-icon {
        font-family: "Google Symbols";
        font-size: 18px;
        width: 18px;
        height: 18px;
        display: inline-block;
        margin-right: var(--bb-grid-size-2);
        color: inherit;
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
      ${this.label
        ? html`<span class="g-icon filled heavy">attach_file</span
            ><span class="label-text">${this.label}</span>`
        : html`<span class="g-icon">add_circle</span>`}
    </button>`;
  }
}
