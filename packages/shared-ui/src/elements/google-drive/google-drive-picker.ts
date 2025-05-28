/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { loadDrivePicker } from "./google-apis.js";

const Strings = BreadboardUI.Strings.forSection("Global");

const BOARD_MIME_TYPES = [
  "application/vnd.breadboard.graph+json",
  "application/json",
].join(",");

export type Mode = "pick-shared-board" | "pick-shared-assets";

@customElement("bb-google-drive-picker")
export class GoogleDrivePicker extends LitElement {
  static styles = [
    css`
      :host {
        display: none;
      }
    `,
  ];

  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @property({ type: Array })
  accessor fileIds: string[] = [];

  @property()
  accessor mode: Mode = "pick-shared-board";

  override render() {
    return nothing;
  }

  async open() {
    switch (this.mode) {
      case "pick-shared-board": {
        // TODO(aomarks) There's a lot of shared code between the two modes, but
        // also lots of small differences. Some kind of cleanup/consolidation
        // might be nice (maybe just factoring out a few functions).
        return this.#openInPickSharedBoardMode();
      }
      case "pick-shared-assets": {
        return this.#openInPickSharedAssetsMode();
      }
      default: {
        console.error(
          `Unknown mode ${JSON.stringify(this.mode satisfies never)}`
        );
        return;
      }
    }
  }

  async #openInPickSharedBoardMode() {
    if (this.fileIds.length === 0) {
      console.error("No file ids to pick");
      return;
    }
    if (this.fileIds.length !== 1) {
      console.error(
        "Expected only one file id to pick, ignoring all but the first",
        this.fileIds
      );
    }
    const pickerLib = await loadDrivePicker();
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      console.error(`Expected "valid" auth state, got "${auth?.state}"`);
      return;
    }

    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes(BOARD_MIME_TYPES);
    view.setFileIds(this.fileIds[0]);
    view.setMode(google.picker.DocsViewMode.GRID);

    const underlay = document.createElement("bb-google-drive-picker-underlay");
    const overlay = document.createElement("bb-google-drive-picker-overlay");
    underlay.mode = overlay.mode = "pick-shared-board";

    // https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .addView(view)
      .setAppId(auth.grant.client_id)
      .setOAuthToken(auth.grant.access_token)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setSize(1200, 480)
      .setCallback((result: google.picker.ResponseObject) => {
        if (result.action === "picked" || result.action === "cancel") {
          overlay.remove();
          underlay.remove();
          picker.dispose();
          resizeObserver?.disconnect();
          if (result.action === "picked") {
            console.log(
              `Google Drive file is now readable: ${JSON.stringify(result)}`
            );
          }
          this.dispatchEvent(new Event("close"));
        } else if (result.action !== "loaded") {
          console.error(`Unhandled picker callback action:`, result.action);
        }
      })
      .build();

    // Note the resize observer is initialized later in this function, but we
    // need a reference now for the callback, so it is declared early.
    let resizeObserver: ResizeObserver | undefined = undefined;

    picker.setVisible(true);

    const { dialog, iframe } = await this.#findPickerDOM();

    // Squish the tile and buttons together vertically.
    iframe.style.height = "430px";

    // Squish the dialog to the width of a single tile.
    dialog.style.width = "225px";
    dialog.style.overflow = "hidden";

    // Remove the dialog's original background styling; we're replacing it.
    dialog.style.background = "none";
    dialog.style.border = "none";
    dialog.style.boxShadow = "none";

    // The dialog is way off-center now, but it monitors for window resize
    // events to re-position itself, so we can fake one of those.
    window.dispatchEvent(new Event("resize"));

    // Detect the dimensions of the dialog so that we can position and size
    // our underlay/overlay accordingly.
    const detectPickerSize = () => {
      const rect = dialog.getBoundingClientRect();
      for (const property of ["top", "left", "width", "height"] as const) {
        document.body.style.setProperty(
          `--google-drive-picker-${property}`,
          `${rect[property]}px`
        );
      }
    };
    detectPickerSize();
    resizeObserver = new ResizeObserver(() => detectPickerSize());
    resizeObserver.observe(dialog);
    resizeObserver.observe(document.body);

    document.body.appendChild(underlay);
    document.body.appendChild(overlay);
  }

  async #openInPickSharedAssetsMode() {
    if (this.fileIds.length === 0) {
      console.error("No file ids to pick");
      return;
    }
    const pickerLib = await loadDrivePicker();
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      console.error(`Expected "valid" auth state, got "${auth?.state}"`);
      return;
    }

    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setFileIds(this.fileIds.join(","));
    view.setMode(google.picker.DocsViewMode.GRID);

    const underlay = document.createElement("bb-google-drive-picker-underlay");
    const overlay = document.createElement("bb-google-drive-picker-overlay");
    underlay.mode = overlay.mode = "pick-shared-assets";

    const picker = new pickerLib.PickerBuilder()
      .addView(view)
      .setAppId(auth.grant.client_id)
      .setOAuthToken(auth.grant.access_token)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setSize(1200, 480)
      .setCallback((result: google.picker.ResponseObject) => {
        if (result.action === "picked" || result.action === "cancel") {
          overlay.remove();
          underlay.remove();
          picker.dispose();
          if (result.action === "picked") {
            console.log(
              `Google Drive file is now readable: ${JSON.stringify(result)}`
            );
          }
          this.dispatchEvent(new Event("close"));
        } else if (result.action !== "loaded") {
          console.error(`Unhandled picker callback action:`, result.action);
        }
      })
      .build();

    // Note the resize observer is initialized later in this function, but we
    // need a reference now for the callback, so it is declared early.
    let resizeObserver: ResizeObserver | undefined = undefined;

    picker.setVisible(true);

    const { dialog } = await this.#findPickerDOM();

    // Remove the dialog's original background styling; we're replacing it.
    dialog.style.background = "none";
    dialog.style.border = "none";
    dialog.style.boxShadow = "none";

    // The dialog is way off-center now, but it monitors for window resize
    // events to re-position itself, so we can fake one of those.
    window.dispatchEvent(new Event("resize"));

    // Detect the dimensions of the dialog so that we can position and size
    // our underlay/overlay accordingly.
    const detectPickerSize = () => {
      const rect = dialog.getBoundingClientRect();
      for (const property of ["top", "left", "width", "height"] as const) {
        document.body.style.setProperty(
          `--google-drive-picker-${property}`,
          `${rect[property]}px`
        );
      }
    };
    detectPickerSize();
    resizeObserver = new ResizeObserver(() => detectPickerSize());
    resizeObserver.observe(dialog);
    resizeObserver.observe(document.body);

    document.body.appendChild(underlay);
    document.body.appendChild(overlay);
  }

  async #findPickerDOM() {
    // TODO(aomarks) Use a mutation observer instead of a loop.
    let dialog, iframe;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      dialog = document.body.querySelector("div.picker-dialog" as "div");
      iframe = dialog?.querySelector("iframe.picker-frame" as "iframe");
      if (dialog && iframe) {
        return { dialog, iframe };
      }
      console.error("Could not find picker, retrying", { dialog, iframe });
      // TODO(aomarks) Give up after a while in case something went wrong.
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-picker": GoogleDrivePicker;
  }
}

@customElement("bb-google-drive-picker-underlay")
export class GoogleDrivePickerUnderlay extends LitElement {
  @property({ reflect: true })
  accessor mode: Mode = "pick-shared-board";

  static styles = [
    css`
      :host {
        position: fixed;
        /* Right below the picker. */
        z-index: 999;
        width: 100vw;
        left: 0;
        display: flex;
        justify-content: center;
      }
      #container {
        background: #fff;
        border-radius: 15px;
        box-shadow: rgb(100 100 111 / 50%) 0 0 10px 3px;
        margin: 0 10px;
      }

      :host([mode="pick-shared-board"]) {
        top: var(--google-drive-picker-top);
        height: calc(var(--google-drive-picker-height) - 30px);
        #container {
          min-width: var(--google-drive-picker-width);
          max-width: 600px;
          width: 100%;
        }
      }
      :host([mode="pick-shared-assets"]) {
        top: var(--google-drive-picker-top);
        height: calc(var(--google-drive-picker-height) + 15px);
        #container {
          width: calc(var(--google-drive-picker-width) + 15px + 15px);
        }
      }
    `,
  ];

  override render() {
    return html`<div id="container"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-picker-underlay": GoogleDrivePickerUnderlay;
  }
}

@customElement("bb-google-drive-picker-overlay")
export class GoogleDrivePickerOverlay extends LitElement {
  @property({ reflect: true })
  accessor mode: Mode = "pick-shared-board";

  @property()
  accessor #showNoDocumentsHelp = false;

  static styles = [
    css`
      :host {
        position: fixed;
        /* Right above the picker. */
        z-index: 1001;
        width: 100vw;
        height: 120px;
        top: calc(var(--google-drive-picker-top) + 15px);
        left: 0;
        display: flex;
        justify-content: center;
      }
      #banner {
        background: #fff;
        font-family: var(--bb-font-family), sans-serif;
        text-align: center;
      }
      h3 {
        font-size: 20px;
        font-weight: 400;
        margin: 30px 0 0 0;
      }
      p {
        font-size: 15px;
        color: #797979;
      }
      #line-hider {
        top: calc(
          var(--google-drive-picker-top) + var(--google-drive-picker-height) -
            123px
        );
        left: var(--google-drive-picker-left);
        position: fixed;
        background: #fff;
        width: var(--google-drive-picker-width);
        height: 5px;
      }
      #no-documents-container {
        position: fixed;
        display: flex;
        flex-direction: column;
        justify-content: center;

        #no-documents-link {
          color: #797979;
          font-size: 12px;
          text-decoration: none;
          &:hover {
            text-decoration: underline;
          }
        }

        #no-documents-help {
          width: 450px;
          background: var(--bb-neutral-700);
          color: var(--bb-neutral-100);
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size);
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          text-align: center;
        }
      }

      :host([mode="pick-shared-board"]) {
        #banner {
          min-width: var(--google-drive-picker-width);
          max-width: 600px;
        }
        #no-documents-container {
          top: calc(
            var(--google-drive-picker-top) + var(--google-drive-picker-height) -
              58px
          );
          width: 600px;
          #no-documents-link {
            text-align: center;
          }
          #no-documents-help {
            margin: 30px auto 0 auto;
          }
        }
      }

      :host([mode="pick-shared-assets"]) {
        #banner {
          width: var(--google-drive-picker-width);
        }
        #no-documents-container {
          top: calc(
            var(--google-drive-picker-top) + var(--google-drive-picker-height) -
              10px
          );
          width: var(--google-drive-picker-width);
          #no-documents-link {
            margin-left: 60px;
          }
          #no-documents-help {
            margin: 30px 0 0 0;
          }
        }
      }
    `,
  ];

  override render() {
    switch (this.mode) {
      case "pick-shared-board": {
        return html`
          <div id="banner">
            <h3>An ${Strings.from("APP_NAME")} has been shared with you!</h3>
            <p>To run it, choose it below and click <em>Select</em>.</p>
          </div>
          <div id="line-hider"></div>
          ${this.#renderNoDocumentsHelp()}
        `;
      }
      case "pick-shared-assets": {
        return html`
          <div id="banner">
            <h3>
              This ${Strings.from("APP_NAME")} requires access to additional
              assets.
            </h3>
            <p>
              To continue, please hold Shift, choose all items listed below, and
              click <em>Select</em>.
            </p>
          </div>
          ${this.#renderNoDocumentsHelp()}
        `;
      }
      default: {
        console.error(
          `Unknown mode ${JSON.stringify(this.mode satisfies never)}`
        );
        return;
      }
    }
  }

  #renderNoDocumentsHelp() {
    return html`
      <div id="no-documents-container">
        <a id="no-documents-link" href="#" @click=${this.#onClickNoDocuments}
          >No documents?</a
        >
        ${this.#showNoDocumentsHelp
          ? html`
              <p id="no-documents-help">
                ${this.#renderNoDocumentsHelpMessage()}
              </p>
            `
          : nothing}
      </div>
    `;
  }

  #renderNoDocumentsHelpMessage() {
    switch (this.mode) {
      case "pick-shared-board": {
        return `If you see "No documents" above, then either this
                ${Strings.from("APP_NAME")} is not shared with you, or it has
                been deleted. Please contact the author.`;
      }
      case "pick-shared-assets": {
        return `If you see "No documents" above, then either the assets required
                by this ${Strings.from("APP_NAME")} are not shared with you, or
                they have been deleted. Please contact the author.`;
      }
      default: {
        console.error(
          `Unknown mode ${JSON.stringify(this.mode satisfies never)}`
        );
        return;
      }
    }
  }

  #onClickNoDocuments(event: Event) {
    event.preventDefault();
    this.#showNoDocumentsHelp = !this.#showNoDocumentsHelp;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-picker-overlay": GoogleDrivePickerOverlay;
  }
}
