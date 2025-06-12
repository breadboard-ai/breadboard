/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { loadDriveShare } from "./google-apis.js";

// Silly dynamic type expression because "gapi.drive.share.ShareClient" doesn't
// resolve for some reason, even though it's declared in a namespace statement
// in "./google-apis.js".
type ShareClient = InstanceType<
  Awaited<ReturnType<typeof loadDriveShare>>["ShareClient"]
>;

// We want only one ShareClient to ever exist globally, and only one user of it
// at a time, because it is stateful. Each instance of ShareClient dumps a bunch
// of DOM into the body the first time the share dialog is opened, but never
// cleans it up, and we don't want this to accumulate.
let globalShareClient: ShareClient | undefined = undefined;
let globalShareClientLocked = false;

@customElement("bb-google-drive-share-panel")
export class GoogleDriveSharePanel extends LitElement {
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
  accessor fileIds: string[] | undefined;

  #status: "closed" | "opening" | "open" = "closed";

  override render() {
    return nothing;
  }

  async open() {
    if (this.#status !== "closed") {
      return;
    }
    const fileIds = this.fileIds;
    if (!fileIds?.length) {
      console.error("No file ids");
      return;
    }
    if (globalShareClientLocked) {
      console.error("Global ShareClient was locked");
      return;
    }
    const auth = await this.signinAdapter?.refresh();
    if (auth?.state !== "valid") {
      console.error(`Expected "valid" auth state, got: ${auth?.state}`);
      return;
    }

    this.#status = "opening";
    globalShareClientLocked = true;
    if (!globalShareClient) {
      const shareLib = await loadDriveShare();
      globalShareClient = new shareLib.ShareClient();
    }

    globalShareClient.setItemIds(fileIds);
    globalShareClient.setOAuthToken(auth.grant.access_token);

    // Weirdly, there is no API for getting the dialog element, or for finding
    // out when the user closes it. Upon opening, a bunch of DOM gets added to
    // document.body. Upon closing, that DOM stays there forever, but becomes
    // hidden. So, as a hack, we can use a MutationObserver to notice these
    // things happening.
    const observer = new MutationObserver(() => {
      const dialog = document.body.querySelector(
        `[guidedhelpid="drive_share_dialog"]`
      );
      if (dialog) {
        const ariaHidden = dialog.getAttribute("aria-hidden");
        if (this.#status === "opening" && ariaHidden !== "true") {
          this.#status = "open";
        } else if (this.#status === "open" && ariaHidden === "true") {
          this.#status = "closed";
          globalShareClientLocked = false;
          observer.disconnect();
          this.dispatchEvent(new Event("close"));
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
    });

    globalShareClient.showSettingsDialog();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-share-panel": GoogleDriveSharePanel;
  }
}
