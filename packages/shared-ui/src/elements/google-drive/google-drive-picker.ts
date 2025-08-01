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
import { GoogleDrivePickerCloseEvent } from "../../events/events.js";
import { getTopLevelOrigin } from "../../utils/embed-helpers.js";
import {
  DriveFileId,
  normalizeFileId,
} from "@breadboard-ai/google-drive-kit/google-drive-client.js";

const Strings = BreadboardUI.Strings.forSection("Global");

const BOARD_MIME_TYPES = [
  "application/vnd.breadboard.graph+json",
  "application/json",
].join(",");

export type Mode = "pick-shared-board" | "pick-shared-assets";

export type DriveFileIdWithOptionalResourceKey = {
  id: string;
  resourcekey?: string;
};

@customElement("bb-google-drive-picker")
export class GoogleDrivePicker extends LitElement {
  static styles = [
    css`
      :host {
        display: none;
      }
      #invisible-resourcekey-iframes-container {
        /* These styles are just here for debugging. Remove "display:none" from
        the ":host" styles above to make the iframes visible during dev. */
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100vw;
        height: 250px;
        display: flex;
        background: magenta;
        padding: 20px;
      }
    `,
  ];

  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

  @property({ type: Array })
  accessor files: Array<DriveFileId | string> = [];

  @property()
  accessor mode: Mode = "pick-shared-board";

  override render() {
    return nothing;
  }

  async open() {
    await this.#preloadFilesThatNeedResourceKeys();
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

  /**
   * Some Drive files have a parameter called a _resource key_ which must be
   * provided to read the file, even if your account otherwise would have read
   * access. Read about them here:
   * https://developers.google.com/workspace/drive/api/guides/resource-keys.
   *
   * However, the Google Drive picker library doesn't have a way to provide a
   * resource key when asking it to display a specific file, meaning the picker
   * will be blank.
   *
   * So we need a workaround. One characteristic of resource keys is that they
   * are only required the very first time a user opens a given Drive file. So,
   * we can get that bit flipped for the user by iframing a Drive preview URL,
   * which _does_ take a resource key. After that iframe loads, the picker
   * should be able to display the file, because the resource key will no longer
   * be required for that user.
   */
  async #preloadFilesThatNeedResourceKeys() {
    const filesWithResourceKeys = this.files
      .map((fileId) => normalizeFileId(fileId))
      .filter(({ resourceKey }) => resourceKey) as Array<Required<DriveFileId>>;
    if (filesWithResourceKeys.length === 0) {
      return;
    }
    const container = document.createElement("div");
    container.id = "invisible-resourcekey-iframes-container";
    const loadPromises = [];
    for (const { id, resourceKey } of filesWithResourceKeys) {
      const iframe = document.createElement("iframe");
      iframe.src =
        `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` +
        `?resourcekey=${encodeURIComponent(resourceKey)}`;
      loadPromises.push(
        new Promise<void>((resolve) => {
          iframe.addEventListener("load", () => resolve(), { once: true });
        })
      );
      container.appendChild(iframe);
    }
    this.shadowRoot!.appendChild(container);
    await Promise.all(loadPromises);
    container.remove();
  }

  async #openInPickSharedBoardMode() {
    if (this.files.length === 0) {
      console.error("No file ids to pick");
      return;
    }
    if (this.files.length !== 1) {
      console.error(
        "Expected only one file id to pick, ignoring all but the first",
        this.files
      );
    }
    const pickerLib = await loadDrivePicker();
    const auth = await this.signinAdapter?.token();
    if (auth?.state !== "valid") {
      console.error(`Expected "valid" auth state, got "${auth?.state}"`);
      return;
    }

    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes(BOARD_MIME_TYPES);
    view.setFileIds(normalizeFileId(this.files[0]).id);
    view.setMode(google.picker.DocsViewMode.GRID);

    const underlay = document.createElement("bb-google-drive-picker-underlay");
    const overlay = document.createElement("bb-google-drive-picker-overlay");
    underlay.mode = overlay.mode = "pick-shared-board";

    // https://developers.google.com/drive/picker/reference
    const picker = new pickerLib.PickerBuilder()
      .setOrigin(getTopLevelOrigin())
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
    if (this.files.length === 0) {
      console.error("No file ids to pick");
      return;
    }
    const pickerLib = await loadDrivePicker();
    const auth = await this.signinAdapter?.token();
    if (auth?.state !== "valid") {
      console.error(`Expected "valid" auth state, got "${auth?.state}"`);
      return;
    }

    const view = new pickerLib.DocsView(google.picker.ViewId.DOCS);
    view.setFileIds(
      this.files.map((fileId) => normalizeFileId(fileId).id).join(",")
    );
    view.setMode(google.picker.DocsViewMode.GRID);

    const underlay = document.createElement("bb-google-drive-picker-underlay");
    const overlay = document.createElement("bb-google-drive-picker-overlay");
    underlay.mode = overlay.mode = "pick-shared-assets";

    const picker = new pickerLib.PickerBuilder()
      .setOrigin(getTopLevelOrigin())
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
          this.dispatchEvent(new GoogleDrivePickerCloseEvent(result));
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
