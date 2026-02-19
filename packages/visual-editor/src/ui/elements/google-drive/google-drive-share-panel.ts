/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { css, LitElement, nothing } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property } from "lit/decorators.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

@customElement("bb-google-drive-share-panel")
export class GoogleDriveSharePanel extends SignalWatcher(LitElement) {
  static styles = [
    css`
      :host {
        display: none;
      }
    `,
  ];

  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ type: Array })
  accessor fileIds: string[] | undefined;

  #status: "closed" | "open" = "closed";

  override render() {
    return nothing;
  }

  async open() {
    if (this.#status === "open") return;
    if (!this.sca.services.shellHost) {
      console.error(`No shell host`);
      return;
    }

    const fileIds = this.fileIds;
    if (!fileIds?.length) {
      console.error("No file ids");
      return;
    }

    this.#status = "open";
    await this.sca.services.shellHost.shareDriveFiles({ fileIds });
    this.#status = "closed";
    this.dispatchEvent(new Event("close"));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-share-panel": GoogleDriveSharePanel;
  }
}
