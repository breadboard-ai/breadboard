/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeCSS } from "lit";
import { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

@customElement("a2ui-custom-google-drive")
export class A2UICustomGoogleDrive extends A2UI.v0_8.UI.Root {
  @property()
  accessor fileUri: A2UI.v0_8.Primitives.StringValue | null = null;

  @property()
  accessor resourceKey: A2UI.v0_8.Primitives.StringValue | null = null;

  static styles = [
    unsafeCSS(A2UI.v0_8.Styles.structuralStyles),
    css`
      :host {
        display: block;
      }

      iframe,
      video {
        display: block;
        width: 100%;
      }

      iframe {
        aspect-ratio: 16/9;

        &.vertical {
          aspect-ratio: 9/16;
        }
      }
    `,
  ];

  #renderDriveElement(fileId: DriveFileId) {
    return html`<bb-google-drive-file-viewer
      .fileId=${fileId}
    ></bb-google-drive-file-viewer>`;
  }

  #renderGDrive() {
    const fileUri = A2UI.v0_8.UI.Utils.extractStringValue(
      this.fileUri,
      this.component,
      this.processor,
      this.surfaceId
    );
    const resourceKey = A2UI.v0_8.UI.Utils.extractStringValue(
      this.resourceKey,
      this.component,
      this.processor,
      this.surfaceId
    );

    if (!fileUri) return html`Unexpected Drive URI`;

    const fileId: DriveFileId = { id: fileUri.substring("drive:/".length) };
    if (resourceKey) {
      fileId.resourceKey = resourceKey;
    }

    return this.#renderDriveElement(fileId);
  }

  render() {
    return html`<section>${this.#renderGDrive()}</section>`;
  }
}
