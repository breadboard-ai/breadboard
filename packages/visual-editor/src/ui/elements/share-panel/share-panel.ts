/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DriveFileId } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import "@material/web/switch/switch.js";
import { type MdSwitch } from "@material/web/switch/switch.js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { scaContext } from "../../../sca/context/context.js";
import type {
  SharePanelStatus,
  UnmanagedAssetProblem,
} from "../../../sca/controller/subcontrollers/editor/share-controller.js";
import { SCA } from "../../../sca/sca.js";
import animations from "../../app-templates/shared/styles/animations.js";
import { ToastEvent } from "../../events/events.js";
import { ToastType } from "../../../sca/types.js";
import * as StringsHelper from "../../strings/helper.js";
import { buttonStyles } from "../../styles/button.js";
import { icons } from "../../styles/icons.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { match } from "../../styles/host/match.js";
import { type GoogleDriveSharePanel } from "../elements.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../config/client-deployment-configuration.js";
import "./share-visibility-selector.js";

const APP_NAME = StringsHelper.forSection("Global").from("APP_NAME");
const Strings = StringsHelper.forSection("UIController");
const SHARING_V2 = CLIENT_DEPLOYMENT_CONFIG.ENABLE_SHARING_2;

@customElement("bb-share-panel")
export class SharePanel extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    buttonStyles,
    animations,
    baseColors,
    match,
    css`
      :host {
        display: contents;
      }

      dialog {
        border-radius: var(--bb-grid-size-4);
        border: none;
        background: light-dark(#fff, #1e1f20);
        color: light-dark(#1b1b1b, #e0e0e0);
        color-scheme: var(--color-scheme, inherit);
        box-shadow:
          0px 4px 8px 3px rgba(0, 0, 0, 0.15),
          0px 1px 3px 0px rgba(0, 0, 0, 0.3);
        font-family: var(--bb-font-family);
        padding: var(--bb-grid-size-5);
        width: 500px;
        min-height: 196px;
        display: flex;
        flex-direction: column;

        /* Match the backdrop of the Google Drive sharing panel, whose style we
           don't (easily) control, and which will replace our own dialog if the
           user clicks "View permissions". */
        &::backdrop {
          background-color: light-dark(#fff, #000);
          opacity: 50%;
        }

        & #advisory {
          color: var(--light-dark-n-40);
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          margin: var(--bb-grid-size-6) 0 0 0;

          a {
            color: light-dark(#5154b3, var(--p-70));
          }
        }
      }

      header {
        display: flex;
        justify-content: space-between;
      }
      h2 {
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
        margin: 0;
      }
      #close-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        font-size: 24px;
      }

      dialog.sharing-v2 {
        padding: var(--bb-grid-size-6);

        h2 {
          font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
            var(--bb-font-family);
          color: var(--sys-color--on-surface);
        }

        #app-link {
          align-items: center;

          #app-link-text {
            background: none;
            color: var(--light-dark-n-35);
            border: none;
          }

          #app-link-copy-button {
            width: 150px;
            height: 40px;
            border: 1px solid light-dark(#f1f1f1, #555);
            background: light-dark(#fff, #2d2d2d);
            color: light-dark(#1b1b1b, #e0e0e0);
            padding: 10px 16px;
            gap: var(--bb-grid-size-2);
            font-family: var(--bb-font-family-flex);
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0;

            &:hover {
              background: light-dark(#f0f0f0, #3a3a3a);
              border-color: light-dark(#999, #777);
            }
          }
        }
      }

      #advisory-v2 {
        color: var(--light-dark-n-40);
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        margin: var(--bb-grid-size-8) 0 0 0;

        a {
          color: light-dark(var(--ui-custom-o-100), var(--p-70));
          font-weight: 700;
          letter-spacing: 0.1px;
          text-decoration: none;

          &:hover {
            text-decoration: underline;
          }
        }
      }

      #editor-access-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--bb-grid-size-9);

        label {
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);
          color: var(--sys-color--on-surface);
          font-family: var(--bb-font-family-flex);
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0;
        }

        .info-icon {
          position: relative;
          font-size: 16px;
          width: 16px;
          height: 16px;
          overflow: visible;
          color: var(--light-dark-n-35);
          padding: 4px;
          margin: -4px;
          cursor: help;
        }

        .info-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #2e2e2e;
          color: #f2f2f2;
          font-family: var(--bb-font-family-flex);
          font-size: 12px;
          font-weight: 400;
          line-height: 16px;
          letter-spacing: 0.1px;
          padding: 6px 10px;
          border-radius: 4px;
          width: max-content;
          max-width: 233px;
          white-space: normal;
          opacity: 0;
          transition: opacity 0.15s ease;
          cursor: text;
          user-select: text;
          pointer-events: none;
        }

        /* Bridges the gap so the cursor can move into the tooltip. */
        .info-icon:hover .info-tooltip::before {
          content: "";
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          height: 8px;
        }

        .info-icon:hover .info-tooltip {
          opacity: 1;
          pointer-events: auto;
        }

        md-switch {
          color-scheme: var(--color-scheme, inherit);
          --md-switch-selected-track-color: light-dark(#1b1b1b, #e0e0e0);
          --md-switch-selected-handle-color: light-dark(#fff, #1b1b1b);
          --md-switch-selected-pressed-track-color: light-dark(
            #1b1b1b,
            #e0e0e0
          );
          --md-switch-selected-pressed-handle-color: light-dark(#fff, #1b1b1b);
          --md-switch-selected-hover-track-color: light-dark(#333, #ccc);
          --md-switch-selected-hover-handle-color: light-dark(#fff, #1b1b1b);
          --md-switch-selected-focus-track-color: light-dark(#1b1b1b, #e0e0e0);
          --md-switch-selected-focus-handle-color: light-dark(#fff, #1b1b1b);
          --md-switch-track-color: light-dark(#e0e0e0, #444);
          --md-switch-handle-color: light-dark(#777, #999);
          --md-switch-track-outline-color: light-dark(#777, #999);
          --md-switch-track-height: 24px;
          --md-switch-track-width: 40px;
          --md-switch-selected-handle-width: 20px;
          --md-switch-selected-handle-height: 20px;
        }

        .toggle-spinner {
          animation: rotate 1s linear infinite;
          font-size: 18px;
          color: var(--light-dark-n-35);
        }

        .toggle-group {
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);
        }

        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      }

      #editor-access-toggle + #app-link {
        margin-top: 44px;
      }

      footer {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--bb-grid-size-12);

        .bb-button-outlined {
          flex-direction: column;
          padding: 10px 16px;
          border: 1px solid var(--light-dark-n-70);
          color: var(--sys-color--on-surface);
          font-family: var(--bb-font-family-flex);
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0;

          &[disabled] {
            opacity: 0.4;
            cursor: wait;
          }
        }
      }

      #loading {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        .spinner {
          margin-right: var(--bb-grid-size-2);
        }
      }

      #error {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: var(--bb-grid-size-3);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        color: var(--bb-ui-600);
        .error-icon {
          font-size: 32px;
          color: var(--bb-warning-color, #b00020);
        }
      }

      #readonly {
        margin: auto 0 auto 0;
        #app-link {
          margin: 0;
        }
      }

      #stale {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--light-dark-n-98);
        margin: var(--bb-grid-size-4) calc(-1 * var(--bb-grid-size-5)) 0
          calc(-1 * var(--bb-grid-size-5));
        padding: 0 var(--bb-grid-size-6);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        color: var(--sys-color--inverse-on-surface);

        .g-icon {
          vertical-align: middle;
          margin-right: var(--bb-grid-size-3);
        }

        button[disabled] {
          cursor: wait;
        }
      }

      #stale-v2 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--bb-grid-size-4);
        background: var(--light-dark-n-95);
        margin: var(--bb-grid-size-4) calc(-1 * var(--bb-grid-size-6)) 0
          calc(-1 * var(--bb-grid-size-6));
        padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
        font-family: var(--bb-font-family-flex);
        font-size: 14px;
        font-weight: 400;
        line-height: normal;
        letter-spacing: 0;
        color: var(--sys-color--on-surface);

        button {
          position: relative;
          font: 700 var(--bb-label-large) / 16px var(--bb-font-family);
          color: var(--light-dark-n-0);
          letter-spacing: 0.25px;
          flex-shrink: 0;
          .spinner {
            position: absolute;
            right: 100%;
            margin-right: var(--bb-grid-size);
          }
        }

        button[disabled] {
          opacity: 0.4;
          cursor: wait;
        }

        p {
          margin: 0 0 var(--bb-grid-size-5) 0;
        }
      }

      #stale-v2 + #advisory-v2 {
        margin-top: var(--bb-grid-size-4);
      }

      #permissions {
        display: flex;
        justify-content: space-between;
        margin-top: var(--bb-grid-size-8);
        min-height: 24px;
        font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
          var(--bb-font-family);
      }
      #disallowed-publishing-notice {
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        text-align: right;
        color: var(--light-dark-e-50);
        max-width: 360px;
        align-self: flex-end;
        margin-top: var(--bb-grid-size-3);
        > a,
        > a:visited {
          color: var(--light-dark-p-40);
          &:hover {
            color: var(--light-dark-p-60);
          }
        }
        > .g-icon {
          vertical-align: middle;
          margin: 0 4px 2px 0;
        }
      }
      #granular-sharing-link {
        text-decoration: none;
        color: var(--ui-custom-o-100);
        font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        margin: var(--bb-grid-size-6) 0 0 0;

        &:hover {
          text-decoration: underline;
        }

        &[disabled] {
          opacity: 60%;
          cursor: wait;
          &:hover {
            text-decoration: none;
          }
        }
      }
      #published-switch-container {
        display: flex;
        align-items: center;
        .spinner {
          margin-right: var(--bb-grid-size-3);
        }
        md-switch {
          --md-switch-track-width: 40px;
          --md-switch-track-height: 24px;
          --md-switch-selected-handle-width: 20px;
          --md-switch-selected-handle-height: 20px;
          --md-sys-color-primary: var(--light-dark-n-10);
          --md-sys-color-primary-container: var(--light-dark-n-98);
          --md-sys-color-surface: var(--light-dark-n-80);
          --md-sys-color-surface-container-highest: var(--light-dark-n-98);
          --md-sys-color-outline: var(--light-dark-n-50);
          &[disabled] {
            cursor: wait;
          }
        }
        label {
          display: inline-block;
          width: 4.5em;
          margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          text-align: center;
          color: var(--sys-color--on-surface);
        }
      }

      #app-link {
        display: flex;
        margin: var(--bb-grid-size-7) 0 0 0;

        #app-link-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: 1px solid var(--light-dark-n-98);
          padding: 0 var(--bb-grid-size-3);
          border-radius: var(--bb-grid-size-2);
          font: 500 var(--bb-body-large) / var(--bb-body-line-height-large)
            var(--bb-font-family);
        }

        #app-link-copy-button {
          margin-left: var(--bb-grid-size-8);
          border-color: var(--light-dark-n-98);
          font-weight: 500;

          &.bb-button-outlined {
            color: var(--sys-color--on-surface-low);
          }
        }
      }

      .g-icon {
        /* Our default icon weight is too thin. */
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
      }

      #unmanaged-assets {
        p {
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          margin: var(--bb-grid-size-7) 0 var(--bb-grid-size) 0;
          &:first-of-type {
            margin-top: var(--bb-grid-size-5);
          }
        }

        #asset-chips {
          .asset-chip {
            background: #fceee9;
            padding: var(--bb-grid-size) var(--bb-grid-size-2);
            border-radius: var(--bb-grid-size-3);
            margin: var(--bb-grid-size-3) var(--bb-grid-size-3) 0 0;
            display: inline-block;
            font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
              var(--bb-font-family);
            a,
            a:visited {
              text-decoration: none;
              color: inherit;
            }
            img {
              filter: grayscale();
              vertical-align: middle;
              margin: 0 6px 2px 0;
            }
          }
        }

        #unmanaged-asset-buttons {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          margin-top: var(--bb-grid-size-6);
          flex: 1;
          button {
            margin-left: var(--bb-grid-size-3);
          }
          .bb-button-text {
            color: var(--light-dark-n-0);
          }
          .bb-button-filled {
            background: var(--light-dark-n-0);
            color: var(--light-dark-n-100);
          }
        }
      }

      .spinner {
        animation: rotate 1s linear infinite;
        color: var(--light-dark-p-40);
        vertical-align: middle;
      }
    `,
  ];

  @consume({ context: scaContext })
  @property({ attribute: false })
  accessor sca!: SCA;

  get #graph() {
    return this.sca.controller.editor.graph.graph;
  }

  get #panel(): SharePanelStatus {
    return this.#controller.panel;
  }

  get #actions() {
    return this.sca.actions.share;
  }

  get #controller() {
    return this.sca.controller.editor.share;
  }

  #dialog = createRef<HTMLDialogElement>();
  #publishedSwitch = createRef<MdSwitch>();
  #googleDriveSharePanel = createRef<GoogleDriveSharePanel>();

  override render() {
    const panel = this.#panel;
    if (panel === "closed") {
      return nothing;
    } else if (panel === "native-share") {
      return this.#renderGranularSharingModal();
    } else {
      return this.#renderModal();
    }
  }

  override updated() {
    if (this.#panel === "native-share") {
      this.#googleDriveSharePanel.value?.open();
    } else if (this.#panel !== "closed") {
      this.#dialog.value?.showModal();
    }
  }

  open(): void {
    this.#actions.open();
  }

  close(): void {
    this.#actions.closePanel();
  }

  #renderModal() {
    const title = this.#graph?.title;
    return html`
      <dialog
        class=${SHARING_V2 ? "sharing-v2" : ""}
        ${ref(this.#dialog)}
        @close=${this.close}
        @cancel=${(e: Event) => {
          if (this.#controller.status !== "ready") {
            e.preventDefault();
          }
        }}
      >
        <header>
          <h2>Share ${title ? `“${title}”` : ""}</h2>
          <button
            id="close-button"
            class="g-icon"
            aria-label="Close"
            .disabled=${this.#controller.status !== "ready"}
            @click=${this.close}
          >
            close
          </button>
        </header>

        ${this.#renderModalContents()}
      </dialog>
    `;
  }

  #renderModalContents() {
    if (this.#controller.error) {
      return this.#renderError();
    }
    // Asset-review takes priority when there are unmanaged asset problems
    // pending resolution (e.g. during publish), OR when notebook domain-sharing
    // limitations need to be surfaced. The action layer blocks on
    // waitForUnmanagedAssetsResolution() in both cases.
    if (
      this.#controller.unmanagedAssetProblems.length > 0 ||
      this.#controller.notebookDomainSharingLimited
    ) {
      return this.#renderUnmanagedAssetsModalContents();
    }
    const status = this.#controller.status;
    // V2 has inline spinners for changing-visibility and publishing-stale,
    // so only show the full-panel loader for statuses without those affordances.
    if (
      SHARING_V2 &&
      (status === "initializing" ||
        status === "syncing-native-share" ||
        status === "syncing-assets")
    ) {
      return this.#renderLoading();
      // V1 has an inline spinner for changing-visibility on the publish switch,
      // so only show the full-panel loader for statuses without inline affordances.
    } else if (
      !SHARING_V2 &&
      (status === "initializing" ||
        status === "syncing-native-share" ||
        status === "publishing-stale" ||
        status === "syncing-assets")
    ) {
      return this.#renderLoading();
    }
    if (this.#controller.ownership === "owner") {
      return CLIENT_DEPLOYMENT_CONFIG.ENABLE_SHARING_2
        ? this.#renderWritableContentsV2()
        : this.#renderWritableContentsV1();
    }
    if (this.#controller.ownership === "non-owner") {
      return this.#renderReadonlyModalContents();
    }
  }

  #renderLoading() {
    return html`
      <div id="loading">
        <span class="g-icon spinner">progress_activity</span>
        Loading ...
      </div>
    `;
  }

  #renderError() {
    return html`
      <div id="error">
        <span class="g-icon error-icon">error</span>
        ${this.#controller.error}
      </div>
    `;
  }

  #renderWritableContentsV1() {
    const shared =
      this.#controller.hasBroadPermissions ||
      this.#controller.hasCustomPermissions;
    return [
      this.#controller.stale && shared ? this.#renderStaleBanner() : nothing,
      html`
        <div id="permissions">
          Publish your ${APP_NAME} ${this.#renderPublishedSwitch()}
        </div>
      `,
      this.#renderDisallowedPublishingNotice(),
      shared && this.#controller.status === "ready"
        ? this.#renderAppLink()
        : nothing,
      this.#renderGranularSharingLink(),
      this.#renderAdvisory(),
    ];
  }

  #renderWritableContentsV2() {
    const shared =
      this.#controller.hasBroadPermissions ||
      this.#controller.hasCustomPermissions;
    return [
      this.#controller.stale && shared ? this.#renderStaleBannerV2() : nothing,
      this.#renderAdvisoryV2(),
      this.#renderVisibilityDropdown(),
      this.#controller.visibility !== "only-you"
        ? this.#renderEditorAccessToggle()
        : nothing,
      shared ? this.#renderAppLink() : nothing,
      this.#renderDoneButton(),
    ];
  }

  #renderStaleBanner() {
    return html`
      <div id="stale">
        <p>
          <span class="g-icon">info</span>
          Your app has unpublished changes
        </p>
        <button
          class="bb-button-text"
          .disabled=${this.#controller.status === "publishing-stale"}
          @click=${this.#onClickPublishStale}
        >
          Update
        </button>
      </div>
    `;
  }

  async #onClickPublishStale() {
    await this.#actions.publishStale();
  }

  #formatLastPublished() {
    const iso = this.#controller.lastPublishedIso;
    if (!iso) {
      return nothing;
    }
    const date = new Date(iso);
    const formatted = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return html`<p>Last Published: ${formatted}</p>`;
  }

  #renderStaleBannerV2() {
    return html`
      <div id="stale-v2">
        <span>
          ${this.#formatLastPublished()} Click publish to update your Opal. This
          ensures everyone with your shared link sees your latest changes.
        </span>
        <button
          class="bb-button-text"
          .disabled=${this.#controller.status !== "ready"}
          @click=${this.#onClickPublishStale}
        >
          ${this.#controller.status === "publishing-stale"
            ? html`<span class="g-icon spin spinner">progress_activity</span>`
            : nothing}
          Publish
        </button>
      </div>
    `;
  }

  #renderEditorAccessToggle() {
    const changing = this.#controller.status === "changing-access";
    return html`
      <div id="editor-access-toggle">
        <label>
          Allow access to editor view and remix
          <span class="g-icon info-icon"
            >info<span class="info-tooltip"
              >Allows others to easily see your prompts and make a copy of your
              Opal.</span
            ></span
          >
        </label>
        <span class="toggle-group">
          ${changing
            ? html`<span class="g-icon toggle-spinner">progress_activity</span>`
            : nothing}
          <md-switch
            .disabled=${this.#controller.status !== "ready"}
            ?selected=${this.#controller.viewerMode === "full"}
            @change=${this.#onViewerModeToggle}
          ></md-switch>
        </span>
      </div>
    `;
  }

  async #onViewerModeToggle(event: Event) {
    const selected = (event.target as MdSwitch).selected;
    await this.#actions.setViewerAccess(selected ? "full" : "app-only");
  }

  #renderReadonlyModalContents() {
    return html`<div id="readonly">${this.#renderAppLink()}</div>`;
  }

  #renderDisallowedPublishingNotice() {
    const status = this.#controller.status;
    if (status !== "ready" && status !== "changing-visibility") {
      return nothing;
    }
    const domain = this.#controller.userDomain;
    if (!domain) {
      return nothing;
    }
    const { disallowPublicPublishing, preferredUrl } =
      this.sca?.env.domains?.[domain] ?? {};
    if (!disallowPublicPublishing) {
      return nothing;
    }
    return html`
      <p id="disallowed-publishing-notice">
        <span class="g-icon">info</span>
        Publishing is disabled for all users from ${domain}.
        <br />
        ${preferredUrl
          ? html`Please use
              <a href="${preferredUrl}" target="_blank"
                >${new URL(preferredUrl).hostname}</a
              >
              to share with other ${domain} users.`
          : nothing}
      </p>
    `;
  }

  #renderAppLink() {
    const appUrl = this.#controller.appUrl;
    if (!appUrl) {
      return nothing;
    }
    return html`
      <div id="app-link">
        <input
          id="app-link-text"
          type="text"
          readonly
          value=${appUrl}
          @click=${this.#onClickLinkText}
        />
        <button
          id="app-link-copy-button"
          class="bb-button-outlined"
          @click=${this.#onClickCopyLinkButton}
        >
          <span class="g-icon">link</span>
          Copy link
        </button>
      </div>
    `;
  }

  #renderGranularSharingLink() {
    return html`
      <a
        id="granular-sharing-link"
        href=""
        @click=${this.#onClickViewSharePermissions}
        ?disabled=${this.#controller.status !== "ready"}
      >
        View Share Permissions
      </a>
    `;
  }

  #renderAdvisory() {
    return html`
      <p id="advisory">
        Granting any access to this app reveals all its content and prompts to
        anyone with access. <strong>Share</strong> to grant access only to
        specific people you choose. <strong>Publish</strong> to create a public
        link for anyone that can also be reshared by anyone. Manage your app's
        visibility at any time from the <strong>'Share app'</strong> menu within
        the ${APP_NAME} app - simply toggle publishing off to unpublish. All
        your ${APP_NAME} apps are saved to your Drive. Remember to share
        <a
          href="https://policies.google.com/terms/generative-ai/use-policy"
          target="_blank"
          >responsibly</a
        >.
      </p>
    `;
  }

  #renderAdvisoryV2() {
    return html`
      <p id="advisory-v2">
        Sharing your Opal app makes it available to anyone with the link. To
        restrict access to your app, you can edit your share permissions so only
        you or specific people you specify can view it.

        <a
          href="https://policies.google.com/terms/generative-ai/use-policy"
          target="_blank"
        >
          Share responsibly.</a
        >

        <a href="https://developers.google.com/opal/faq" target="_blank"
          >Learn more.</a
        >
      </p>
    `;
  }

  #renderDoneButton() {
    return html`
      <footer>
        <button
          class="bb-button-outlined"
          .disabled=${this.#controller.status !== "ready"}
          @click=${this.close}
        >
          Done
        </button>
      </footer>
    `;
  }

  #renderVisibilityDropdown() {
    return html`<bb-share-visibility-selector></bb-share-visibility-selector>`;
  }

  #renderPublishedSwitch() {
    const status = this.#controller.status;
    if (status !== "ready" && status !== "changing-visibility") {
      return nothing;
    }
    const published = this.#controller.hasBroadPermissions;
    const domain = this.#controller.userDomain;
    const { disallowPublicPublishing } = this.sca?.env.domains?.[domain] ?? {};

    const disabled =
      disallowPublicPublishing || status === "changing-visibility";
    return html`
      <div id="published-switch-container">
        ${status === "changing-visibility"
          ? html`<span class="g-icon spin spinner">progress_activity</span>`
          : nothing}
        <md-switch
          ${ref(this.#publishedSwitch)}
          ?selected=${published}
          ?disabled=${disabled}
          @change=${this.#onPublishedSwitchChange}
        ></md-switch>
        <label for="publishedSwitch">
          ${published ? "Public" : "Private"}
        </label>
      </div>
    `;
  }

  #renderGranularSharingModal() {
    const panel = this.#panel;
    if (panel !== "native-share" || !this.#controller.shareableFile) {
      return nothing;
    }
    return html`
      <bb-google-drive-share-panel
        ${ref(this.#googleDriveSharePanel)}
        .fileIds=${[this.#controller.shareableFile.id]}
        @close=${this.#onGoogleDriveSharePanelClose}
      ></bb-google-drive-share-panel>
    `;
  }

  #renderUnmanagedAssetsModalContents() {
    const problems = this.#controller.unmanagedAssetProblems;
    const domainLimited = this.#controller.notebookDomainSharingLimited;
    if (problems.length === 0 && !domainLimited) {
      return nothing;
    }

    const renderAssetChip = (p: UnmanagedAssetProblem) => {
      const name = p.type === "drive" ? p.asset.name : p.notebookName;
      const url =
        p.type === "drive"
          ? driveOpenUrl(p.asset)
          : `https://notebooklm.google.com/notebook/${p.notebookId}`;
      const icon =
        p.type === "drive" ? html`<img src=${p.asset.iconLink} />` : html`📓`;
      return html`
        <span class="asset-chip">
          ${icon}
          <a href=${url} target="_blank">${name}</a>
        </span>
      `;
    };

    const parts = [];

    const missingProblems = problems.filter(
      ({ problem }) => problem === "missing"
    );
    if (missingProblems.length > 0) {
      parts.push(html`
        <p>
          The following assets are editable by you, but are not yet shared with
          all users of this app. To share them now, choose "Share my assets".
        </p>
        <div id="asset-chips">${missingProblems.map(renderAssetChip)}</div>
      `);
    }

    const cantShareProblems = problems.filter(
      ({ problem }) => problem === "cant-share"
    );
    if (cantShareProblems.length > 0) {
      parts.push(html`
        <p>
          The following assets are <strong>not</strong> editable by you, and we
          unable to verify whether they are shared with all users of this app.
          If you believe the assets are shared (e.g. they are public), you may
          safely ignore this warning. If you are unsure, contact the owner of
          the asset, or replace it with an asset you do own.
        </p>
        <div id="asset-chips">${cantShareProblems.map(renderAssetChip)}</div>
      `);
    }

    if (this.#controller.notebookDomainSharingLimited) {
      parts.push(html`
        <p>
          <strong>Note:</strong> NotebookLM notebooks cannot be shared with
          domain-wide or public access. They must be shared individually with
          each user.
        </p>
      `);
    }

    if (missingProblems.length > 0) {
      parts.push(html`
        <div id="unmanaged-asset-buttons">
          <button
            class="bb-button-text"
            @click=${this.#onClickDismissUnmanagedAssetProblems}
          >
            Ignore
          </button>
          <button
            id="share-unmanaged-assets-button"
            class="bb-button-filled"
            @click=${this.#onClickFixUnmanagedAssetProblems}
          >
            Share my assets
          </button>
        </div>
      `);
    } else {
      parts.push(html`
        <div id="unmanaged-asset-buttons">
          <button
            class="bb-button-filled"
            @click=${this.#onClickDismissUnmanagedAssetProblems}
          >
            I understand
          </button>
        </div>
      `);
    }
    return html`<div id="unmanaged-assets">${parts}</div>`;
  }

  async #onClickDismissUnmanagedAssetProblems() {
    await this.#actions.dismissUnmanagedAssetProblems();
  }
  async #onClickFixUnmanagedAssetProblems() {
    await this.#actions.fixUnmanagedAssetProblems();
  }

  async #onClickViewSharePermissions(event: MouseEvent) {
    event.preventDefault();
    await this.#actions.viewSharePermissions();
  }

  #onPublishedSwitchChange() {
    const input = this.#publishedSwitch.value;
    if (!input) {
      console.error("Expected input element to be rendered");
      return;
    }
    if (!this.#graph?.url) {
      console.error("No graph url");
      return;
    }
    const selected = input.selected;
    if (selected) {
      this.sca?.services.actionTracker?.publishApp(this.#graph.url);
      this.#actions.publish();
    } else {
      this.#actions.unpublish();
    }
  }

  async #onClickLinkText(event: MouseEvent & { target: HTMLInputElement }) {
    event.target.select();
  }

  async #onClickCopyLinkButton() {
    const appUrl = this.#controller.appUrl;
    if (!appUrl) {
      console.error("No app url");
      return;
    }
    await navigator.clipboard.writeText(appUrl);
    this.dispatchEvent(
      new ToastEvent(
        Strings.from("STATUS_COPIED_TO_CLIPBOARD"),
        ToastType.INFORMATION
      )
    );
  }

  async #onGoogleDriveSharePanelClose() {
    await this.#actions.onGoogleDriveSharePanelClose();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-panel": SharePanel;
  }
}

function driveOpenUrl({ id, resourceKey }: DriveFileId): string {
  const url = new URL("https://drive.google.com/open");
  url.searchParams.set("id", id);
  if (resourceKey) {
    url.searchParams.set("resourcekey", resourceKey);
  }
  return url.href;
}
