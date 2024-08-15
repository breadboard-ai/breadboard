/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { OverlayDismissEvent, ToastEvent } from "../../events/events.js";
import { InviteManager } from "../../utils/invite.js";
import { until } from "lit/directives/until.js";
import { map } from "lit/directives/map.js";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

@customElement("bb-board-invites")
export class BoardInvites extends LitElement {
  @property()
  key: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.05);
      position: fixed;
      top: 0;
      z-index: 100;
      align-items: center;
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    dialog {
      background: var(--bb-neutral-0);
      width: 80vw;
      max-width: 360px;
      border: none;
      border-radius: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-3);
    }

    dialog h1 {
      font: var(--bb-font-title-small);
      font-weight: 500;
      margin: 0 0 var(--bb-grid-size-2) 0;
      padding-left: var(--bb-grid-size-6);
      background: transparent var(--bb-icon-rsvp) 0 center / 20px 20px no-repeat;
    }

    .create-invite {
      background: var(--bb-ui-100) var(--bb-icon-rsvp) 8px 4px / 16px 16px
        no-repeat;
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
      cursor: pointer;
    }

    #cancel {
      background: var(--bb-neutral-100);
      color: var(--bb-neutral-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
      cursor: pointer;
    }

    #loading {
      padding-left: var(--bb-grid-size-8);
      background: url(/images/progress-ui.svg) left center / 16px 16px no-repeat;
    }

    #invite-listing {
      margin: var(--bb-grid-size-2) 0;
      padding: 0;
      list-style: none;
    }

    #invite-listing li {
      margin-bottom: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size);
      background: var(--bb-ui-50);
      display: flex;
      align-items: center;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
    }

    #invite-listing .delete {
      height: 24px;
      width: 24px;
      font-size: 0;
      background: var(--bb-neutral-0) var(--bb-icon-delete) center center / 16px
        16px no-repeat;
      flex: 0 0 auto;
      border: none;
      border-radius: 50%;
      opacity: 0.5;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
      margin-right: var(--bb-grid-size-2);
    }

    #invite-listing .delete:hover,
    #invite-listing .delete:focus {
      transition-duration: 0.1s;
      opacity: 1;
    }

    #invite-listing .copy-to-clipboard {
      height: 24px;
      width: 24px;
      font-size: 0;
      background: var(--bb-neutral-0) var(--bb-icon-copy-to-clipboard) center
        center / 16px 16px no-repeat;
      flex: 0 0 auto;
      border: none;
      border-radius: 50%;
      opacity: 0.5;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
    }

    #invite-listing .copy-to-clipboard:hover,
    #invite-listing .copy-to-clipboard:focus {
      transition-duration: 0.1s;
      opacity: 1;
    }

    .label {
      flex: 1;
    }

    .code {
      font: var(--bb-font-title-small);
      font-weight: 500;
      font-family: var(--bb-font-family-mono);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onClickBound = this.#onClick.bind(this);

  #invites = new InviteManager();
  #loadInvites = this.#refreshInviteList();
  #creating = false;
  #deleting = false;
  #copying = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("click", this.#onClickBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("click", this.#onClickBound);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.dispatchEvent(new OverlayDismissEvent());
  }

  #onClick() {
    this.dispatchEvent(new OverlayDismissEvent());
  }

  #refreshInviteList() {
    return this.#invites.canCreateInvite().then(async (canCreate) => {
      if (!canCreate) {
        return html`<div>
          <p>
            You are not able to manage invites for this board. You can only
            manage invites for boards you created.
          </p>
        </div>`;
      }

      const listing = await this.#invites.listInvites();
      if (!listing.success) {
        return html`<div>Unable to load invites</div>`;
      }

      return html`<div>
        ${listing.invites.length > 0
          ? html`<ul id="invite-listing">
              ${map(listing.invites, (invite) => {
                return html`<li>
                  <div class="label">
                    Invite code: <span class="code">${invite}</span>
                  </div>
                  <button
                    class="delete"
                    @click=${async () => {
                      if (this.#deleting) {
                        return;
                      }

                      if (
                        !confirm("Are you sure you want to delete this invite?")
                      ) {
                        return;
                      }

                      this.#deleting = true;
                      const result = await this.#invites.deleteInvite(invite);
                      this.#deleting = false;

                      if ("success" in result && !result.success) {
                        this.dispatchEvent(
                          new ToastEvent(
                            "Unable to delete invite",
                            BreadboardUI.Events.ToastType.ERROR
                          )
                        );
                      } else {
                        this.#loadInvites = this.#refreshInviteList();
                        this.requestUpdate();
                      }
                    }}
                  >
                    Copy to clipboard
                  </button>
                  <button
                    class="copy-to-clipboard"
                    @click=${async () => {
                      const inviteLink = this.#invites.inviteUrl(
                        invite
                      ) as string;

                      if (this.#copying) {
                        return;
                      }
                      this.#copying = true;
                      await navigator.clipboard.writeText(inviteLink);
                      this.#copying = false;

                      this.dispatchEvent(
                        new ToastEvent(
                          "Invite copied to clipboard",
                          BreadboardUI.Events.ToastType.INFORMATION
                        )
                      );
                    }}
                  >
                    Copy to clipboard
                  </button>
                </li>`;
              })}
            </ul>`
          : html`<p>There are no active invites for this board</p>
              <button
                @click=${async () => {
                  if (this.#creating) {
                    return;
                  }
                  this.#creating = true;
                  const result = await this.#invites.getOrCreateInvite();
                  this.#creating = false;
                  if (result.success) {
                    this.#loadInvites = this.#refreshInviteList();
                    this.requestUpdate();
                  } else {
                    this.dispatchEvent(
                      new ToastEvent(
                        "Unable to create invite",
                        BreadboardUI.Events.ToastType.ERROR
                      )
                    );
                  }
                }}
                class="create-invite"
              >
                Create an invite link
              </button> `}
      </div>`;
    });
  }

  render() {
    return html`<dialog
      open
      @click=${(evt: Event) => {
        evt.stopImmediatePropagation();
      }}
    >
      <h1>Manage invites</h1>
      ${until(
        this.#loadInvites,
        html`<div id="loading">Loading invites...</div>`
      )}

      <button
        @click=${() => {
          this.dispatchEvent(new OverlayDismissEvent());
        }}
        id="cancel"
      >
        Close
      </button>
    </dialog>`;
  }
}
