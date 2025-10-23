/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { consume } from "@lit/context";
import { css, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { opalShellContext } from "../../utils/opal-shell-guest.js";

@customElement("bb-google-drive-share-panel")
export class GoogleDriveSharePanel extends LitElement {
  static styles = [
    css`
      :host {
        display: none;
      }
    `,
  ];

  @consume({ context: opalShellContext })
  accessor opalShell: OpalShellProtocol | undefined;

  @property({ type: Array })
  accessor fileIds: string[] | undefined;

  #status: "closed" | "open" = "closed";

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
    if (!this.opalShell) {
      console.error(`No opal shell`);
      return;
    }

    this.#status = "open";
    await this.opalShell.shareDriveFiles({ fileIds });
    this.#status = "closed";
    this.dispatchEvent(new Event("close"));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-google-drive-share-panel": GoogleDriveSharePanel;
  }
}
