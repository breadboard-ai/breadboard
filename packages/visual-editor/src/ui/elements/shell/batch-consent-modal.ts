/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { SignalWatcher } from "@lit-labs/signals";
import { ModalDismissedEvent } from "../../events/events.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { SCA } from "../../../sca/sca.js";
import type { DriveAssetConsentInfo } from "../../../sca/types.js";

@customElement("bb-batch-consent-modal")
export class VEBatchConsentModal extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    type,
    baseColors,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      bb-modal {
        &::part(container) {
          display: flex;
          flex-direction: column;
          width: 520px;
          max-width: 85%;
        }
      }

      .consent-body {
        color: var(--light-dark-n-30);

        & p {
          font-family: var(--bb-font-family, var(--default-font-family));
          font-size: 14px;
          line-height: 20px;
          margin: 0 0 var(--bb-grid-size-3) 0;
        }
      }

      .asset-list {
        list-style: none;
        margin: var(--bb-grid-size-3) 0;
        padding: 0;
        max-height: 240px;
        overflow-y: auto;
      }

      .asset-item {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
        border: 1px solid var(--light-dark-p-90);
        border-radius: var(--bb-grid-size-2);
        background: var(--light-dark-p-98);
        margin-bottom: var(--bb-grid-size-2);

        & img {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        & a {
          color: var(--light-dark-p-40);
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          &:hover {
            text-decoration: underline;
          }
        }
      }
    `,
  ];

  #handleModalDismissed({ withSave }: ModalDismissedEvent) {
    this.sca.controller.global.consent.resolveBatchConsent(withSave);
  }

  #buildDriveUrl(asset: DriveAssetConsentInfo): string {
    const url = new URL("https://drive.google.com/open");
    url.searchParams.set("id", asset.fileId);
    if (asset.resourceKey) {
      url.searchParams.set("resourcekey", asset.resourceKey);
    }
    return url.href;
  }

  render() {
    const pending = this.sca.controller.global.consent.pendingBatchConsent;
    if (!pending) {
      return nothing;
    }

    const { assets } = pending;

    return html`<bb-modal
      modalTitle="Opal App - Drive Assets Used"
      .showCloseButton=${true}
      .showSaveCancel=${true}
      .blurBackground=${true}
      appearance="basic"
      saveButtonLabel="Allow & Continue"
      @bbmodaldismissed=${this.#handleModalDismissed}
    >
      <div class="consent-body">
        <p>
          This Opal app uses the following Google Drive
          ${assets.length === 1 ? "file" : "files"}. By continuing, you allow
          the app to read and process ${assets.length === 1 ? "its" : "their"}
          contents.
        </p>

        <ul class="asset-list">
          ${assets.map((asset) => {
            const iconSrc = asset.iconLink?.replace(/\/16\//, "/32/") || "";
            return html`
              <li class="asset-item">
                ${iconSrc
                  ? html`<img src=${iconSrc} alt="" />`
                  : nothing}
                <a href=${this.#buildDriveUrl(asset)} target="_blank">
                  ${asset.fileName}
                </a>
              </li>
            `;
          })}
        </ul>

        <p>
          If you do not trust this app, click Cancel to stop execution.
        </p>
      </div>
    </bb-modal>`;
  }
}
