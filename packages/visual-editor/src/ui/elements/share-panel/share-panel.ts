/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GraphDescriptor } from "@breadboard-ai/types";
import type { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";
import type {
  DriveFileId,
} from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import "@material/web/switch/switch.js";
import { type MdSwitch } from "@material/web/switch/switch.js";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { scaContext } from "../../../sca/context/context.js";
import type {
  ShareState,
} from "../../../sca/controller/subcontrollers/editor/share-controller.js";
import { SCA } from "../../../sca/sca.js";
import { makeShareLinkFromTemplate } from "../../../utils/make-share-link-from-template.js";
import animations from "../../app-templates/shared/styles/animations.js";
import { actionTrackerContext } from "../../contexts/action-tracker-context.js";
import {
  globalConfigContext,
  type GlobalConfig,
} from "../../contexts/global-config.js";
import { guestConfigurationContext } from "../../contexts/guest-configuration.js";
import { ToastEvent, ToastType } from "../../events/events.js";
import * as StringsHelper from "../../strings/helper.js";
import { buttonStyles } from "../../styles/button.js";
import { icons } from "../../styles/icons.js";
import { ActionTracker } from "../../types/types.js";
import { makeUrl } from "../../utils/urls.js";
import { type GoogleDriveSharePanel } from "../elements.js";

const APP_NAME = StringsHelper.forSection("Global").from("APP_NAME");
const Strings = StringsHelper.forSection("UIController");

@customElement("bb-share-panel")
export class SharePanel extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    buttonStyles,
    animations,
    css`
      :host {
        display: contents;
      }

      dialog {
        border-radius: var(--bb-grid-size-4);
        border: none;
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
          background-color: #fff;
          opacity: 50%;
        }

        & #advisory {
          color: var(--light-dark-n-40);
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          margin: var(--bb-grid-size-6) 0 0 0;

          a {
            color: var(--light-dark-p-40);
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
            color: #000;
          }
          .bb-button-filled {
            background: #000;
            color: #fff;
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

  @consume({ context: globalConfigContext })
  @property({ attribute: false })
  accessor globalConfig: GlobalConfig | undefined;

  @consume({ context: scaContext })
  @property({ attribute: false })
  accessor sca!: SCA;


  @consume({ context: guestConfigurationContext })
  accessor guestConfiguration: GuestConfiguration | undefined;

  @consume({ context: actionTrackerContext })
  accessor actionTracker: ActionTracker | undefined;

  @property({ attribute: false })
  accessor graph: GraphDescriptor | undefined;

  get #state(): ShareState {
    return this.#controller.state;
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

  override willUpdate(changes: PropertyValues<this>) {
    super.willUpdate(changes);
    if (changes.has("graph") && this.#state.status !== "closed") {
      this.#actions.openPanel();
    }
    if (this.#state.status === "opening" && this.graph) {
      this.#actions.readPublishedState(
        this.graph,
        this.#getRequiredPublishPermissions()
      );
    }
  }

  override render() {
    const { status } = this.#state;
    if (status === "closed" || status === "opening") {
      return nothing;
    } else if (status === "granular") {
      return this.#renderGranularSharingModal();
    } else {
      return this.#renderModal();
    }
  }

  override updated() {
    if (this.#state.status === "granular") {
      this.#googleDriveSharePanel.value?.open();
    } else if (this.#state.status !== "closed") {
      this.#dialog.value?.showModal();
    }
  }

  open(): void {
    this.#actions.openPanel();
  }

  close(): void {
    this.#actions.closePanel();
  }

  #renderModal() {
    const title = this.graph?.title;
    return html`
      <dialog ${ref(this.#dialog)} @close=${this.close}>
        <header>
          <h2>Share ${title ? `“${title}”` : ""}</h2>
          <button
            id="close-button"
            class="g-icon"
            aria-label="Close"
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
    const { status } = this.#state;
    if (status === "loading") {
      return this.#renderLoading();
    }
    if (status === "writable" || status === "updating") {
      return this.#renderModifiableModalContents();
    }
    if (status === "readonly") {
      return this.#renderReadonlyModalContents();
    }
    if (status === "unmanaged-assets") {
      return this.#renderUnmanagedAssetsModalContents();
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

  get #isShared(): boolean | undefined {
    const state = this.#state;
    const { status } = state;
    if (status === "readonly") {
      // If we're readonly, then we're not the owner. And if we're not the
      // owner, and yet here we are, then it must be shared with us one way or
      // the other.
      return true;
    }
    if (status === "writable" || status === "updating") {
      return state.published || state.granularlyShared;
    }
    return undefined;
  }

  get #isStale(): boolean | undefined {
    const state = this.#state;
    const { status } = state;
    if (status === "writable" || status === "updating") {
      return state.shareableFile?.stale ?? false;
    }
    return undefined;
  }

  #renderModifiableModalContents() {
    return [
      this.#isStale && this.#isShared ? this.#renderStaleBanner() : nothing,
      html`
        <div id="permissions">
          Publish your ${APP_NAME} ${this.#renderPublishedSwitch()}
        </div>
      `,
      this.#renderDisallowedPublishingNotice(),
      this.#isShared && this.#state.status !== "updating"
        ? this.#renderAppLink()
        : nothing,
      this.#renderGranularSharingLink(),
      this.#renderAdvisory(),
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
          .disabled=${this.#state.status !== "writable"}
          @click=${this.#onClickPublishStale}
        >
          Update
        </button>
      </div>
    `;
  }
  async #onClickPublishStale() {
    if (!this.graph) {
      return;
    }
    await this.#actions.publishStale(this.graph);
  }

  #renderReadonlyModalContents() {
    return html`<div id="readonly">${this.#renderAppLink()}</div>`;
  }

  #renderDisallowedPublishingNotice() {
    if (
      this.#state.status !== "writable" &&
      this.#state.status !== "updating"
    ) {
      return nothing;
    }
    const domain = this.#state.userDomain;
    if (!domain) {
      return nothing;
    }
    const { disallowPublicPublishing, preferredUrl } =
      this.globalConfig?.domains?.[domain] ?? {};
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
    const appUrl = this.#appUrl;
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
        ?disabled=${this.#state.status !== "writable"}
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

  #renderPublishedSwitch() {
    const { status } = this.#state;
    if (status !== "writable" && status !== "updating") {
      return nothing;
    }
    const published =
      (status === "writable" || status === "updating") && this.#state.published;

    const domain = this.#state.userDomain;
    const { disallowPublicPublishing } =
      this.globalConfig?.domains?.[domain] ?? {};

    const disabled = disallowPublicPublishing || status === "updating";
    return html`
      <div id="published-switch-container">
        ${status === "updating"
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
    if (this.#state.status !== "granular") {
      return nothing;
    }
    return html`
      <bb-google-drive-share-panel
        ${ref(this.#googleDriveSharePanel)}
        .fileIds=${[this.#state.shareableFile.id]}
        @close=${this.#onGoogleDriveSharePanelClose}
      ></bb-google-drive-share-panel>
    `;
  }

  #renderUnmanagedAssetsModalContents() {
    const state = this.#state;
    if (state.status !== "unmanaged-assets") {
      return nothing;
    }

    const parts = [];

    const missingProblems = state.problems.filter(
      ({ problem }) => problem === "missing"
    );
    if (missingProblems.length > 0) {
      const missingChips = missingProblems.map(({ asset }) => {
        return html`
          <span class="asset-chip">
            <img src=${asset.iconLink} />
            <a href=${driveOpenUrl(asset)} target="_blank">${asset.name}</a>
          </span>
        `;
      });
      parts.push(html`
        <p>
          The following assets are editable by you, but are not yet shared with
          all users of this app. To share them now, choose "Share my assets".
        </p>
        <div id="asset-chips">${missingChips}</div>
      `);
    }

    const cantShareProblems = state.problems.filter(
      ({ problem }) => problem === "cant-share"
    );
    if (cantShareProblems.length > 0) {
      const cantShareChips = cantShareProblems.map(({ asset }) => {
        return html`
          <span class="asset-chip">
            <img src=${asset.iconLink} />
            <a href=${driveOpenUrl(asset)} target="_blank">${asset.name}</a>
          </span>
        `;
      });
      parts.push(html`
        <p>
          The following assets are <strong>not</strong> editable by you, and we
          unable to verify whether they are shared with all users of this app.
          If you believe the assets are shared (e.g. they are public), you may
          safely ignore this warning. If you are unsure, contact the owner of
          the asset, or replace it with an asset you do own.
        </p>
        <div id="asset-chips">${cantShareChips}</div>
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
    const state = this.#state;
    if (state.status !== "unmanaged-assets") {
      return;
    }
    state.closed.resolve();
  }
  async #onClickFixUnmanagedAssetProblems() {
    await this.#actions.fixUnmanagedAssetProblems();
  }

  async #onClickViewSharePermissions(event: MouseEvent) {
    event.preventDefault();
    if (!this.graph) {
      return;
    }
    await this.#actions.viewSharePermissions(this.graph, this.guestConfiguration?.shareSurface);
  }

  #onPublishedSwitchChange() {
    const input = this.#publishedSwitch.value;
    if (!input) {
      console.error("Expected input element to be rendered");
      return;
    }
    if (!this.graph?.url) {
      console.error("No graph url");
      return;
    }
    const selected = input.selected;
    if (selected) {
      this.actionTracker?.publishApp(this.graph.url);
      this.#actions.publish(this.graph, this.#getRequiredPublishPermissions(), this.guestConfiguration?.shareSurface);
    } else {
      this.#actions.unpublish(this.graph);
    }
  }

  async #onClickLinkText(event: MouseEvent & { target: HTMLInputElement }) {
    event.target.select();
  }

  async #onClickCopyLinkButton() {
    const appUrl = this.#appUrl;
    if (!appUrl) {
      console.error("No app url");
      return nothing;
    }
    await navigator.clipboard.writeText(appUrl);
    this.dispatchEvent(
      new ToastEvent(
        Strings.from("STATUS_COPIED_TO_CLIPBOARD"),
        ToastType.INFORMATION
      )
    );
  }

  get #appUrl(): string | undefined {
    const state = this.#state;
    if (
      (state.status === "writable" ||
        state.status === "updating" ||
        state.status === "readonly") &&
      state.shareableFile
    ) {
      const shareSurface = this.guestConfiguration?.shareSurface;
      const shareSurfaceUrlTemplate =
        shareSurface &&
        this.guestConfiguration?.shareSurfaceUrlTemplates?.[shareSurface];
      if (shareSurfaceUrlTemplate) {
        return makeShareLinkFromTemplate({
          urlTemplate: shareSurfaceUrlTemplate,
          fileId: state.shareableFile.id,
          resourceKey: state.shareableFile.resourceKey,
        });
      }
      return makeUrl(
        {
          page: "graph",
          mode: "app",
          flow: `drive:/${state.shareableFile.id}`,
          resourceKey: state.shareableFile.resourceKey,
          shared: true,
          guestPrefixed: false,
        },
        this.globalConfig?.hostOrigin
      );
    }
    return undefined;
  }
  async #onGoogleDriveSharePanelClose() {
    if (!this.graph) {
      return;
    }
    await this.#actions.onGoogleDriveSharePanelClose(this.graph);
  }

  #getRequiredPublishPermissions(): gapi.client.drive.Permission[] {
    if (!this.globalConfig) {
      console.error(`No environment was provided`);
      return [];
    }
    const permissions = this.globalConfig.googleDrive.publishPermissions;
    if (permissions.length === 0) {
      console.error(`Environment contained no googleDrive.publishPermissions`);
    }
    return permissions.map((permission) => ({ role: "reader", ...permission }));
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
