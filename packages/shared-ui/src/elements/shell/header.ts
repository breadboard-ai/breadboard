/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { SigninAdapter } from "../../utils/signin-adapter.js";
import { BOARD_SAVE_STATUS, EnumValue } from "../../types/types.js";
import { icons } from "../../styles/icons.js";
import {
  BoardTitleUpdateEvent,
  CloseEvent,
  ModeToggleEvent,
  RemixEvent,
  ShareRequestedEvent,
  SignOutEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-ve-header")
export class VEHeader extends LitElement {
  @property()
  accessor signinAdapter: SigninAdapter | null = null;

  @property()
  accessor hasActiveTab = false;

  @property()
  accessor tabTitle: string | null = null;

  @property()
  accessor canSave = false;

  @property()
  accessor isMine = false;

  @property()
  accessor showExperimentalComponents = false;

  @property()
  accessor saveStatus: BOARD_SAVE_STATUS | null = null;

  @property()
  accessor mode: "app" | "canvas" = "canvas";

  @state()
  accessor #showAccountSwitcher = false;

  static styles = [
    icons,
    colorsLight,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        height: 100%;
        width: 100%;
        container-type: inline-size;
      }

      section {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--n-90);
        padding: 0 var(--bb-grid-size-5);
        overflow: hidden;

        & #left {
          display: flex;
          align-items: center;
        }

        & #mode-toggle {
          padding: 0;
          margin: 0;
          display: flex;
          gap: var(--bb-grid-size);
          height: var(--bb-grid-size-8);
          border: none;
          background: none;

          & #app,
          & #canvas {
            display: flex;
            align-items: center;
            padding: 0 var(--bb-grid-size-3);
            background: var(--n-90);
            cursor: pointer;
            height: var(--bb-grid-size-8);
            border: none;

            &.selected {
              background: var(--ui-custom-o-25);
              cursor: auto;
            }
          }

          & #app {
            border-radius: var(--bb-grid-size-16) var(--bb-grid-size-5)
              var(--bb-grid-size-5) var(--bb-grid-size-16);
          }

          & #canvas {
            border-radius: var(--bb-grid-size-5) var(--bb-grid-size-16)
              var(--bb-grid-size-16) var(--bb-grid-size-5);
          }
        }

        & #right {
          display: flex;
          align-items: center;

          bb-item-select {
            --selected-item-padding-left: 0;
            --selected-item-padding-right: 0;

            margin: 0 0 0 var(--bb-grid-size-6);
          }

          & #save-status-label {
            font-size: 10px;
            line-height: 1;
            color: var(--ui-secondary-text);
            margin: 0 0 0 var(--bb-grid-size-6);
          }

          & #toggle-user-menu {
            height: var(--bb-grid-size-7);
            padding: 0;
            margin: 0 0 0 var(--bb-grid-size-6);
            background: none;
            border: none;
            cursor: pointer;

            & #user-pic {
              display: block;
              width: var(--bb-grid-size-7);
              height: var(--bb-grid-size-7);
              border-radius: 50%;
              pointer-events: none;
            }
          }

          & #share {
            display: flex;
            align-items: center;
            background: var(--n-100);
            border: 1px solid var(--n-95);
            border-radius: var(--bb-grid-size-16);
            margin: 0 0 0 var(--bb-grid-size-6);

            color: var(--n-0);
            height: var(--bb-grid-size-8);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
            font-size: 12px;
            transition: border 0.2s cubic-bezier(0, 0, 0.2, 1);

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
            }

            &:not([disabled]) {
              cursor: pointer;

              &:hover {
                border: 1px solid var(--n-80);
              }
            }
          }

          & #remix {
            display: flex;
            align-items: center;
            background: var(--n-0);
            border: none;
            border-radius: var(--bb-grid-size-16);
            margin: 0 0 0 var(--bb-grid-size-6);

            color: var(--n-100);
            height: var(--bb-grid-size-8);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
            font-size: 12px;
            transition: background 0.2s cubic-bezier(0, 0, 0.2, 1);

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
            }

            &:not([disabled]) {
              cursor: pointer;

              &:hover {
                background: var(--n-10);
              }
            }
          }
        }
      }

      h1,
      #tab-title {
        margin: 0;
        line-height: 1;
        color: var(--n-0);
        display: flex;
        align-items: center;

        & #app-title {
          font-size: 26px;
        }
      }

      #tab-title {
        font-size: 16px;

        padding: var(--bb-grid-size) var(--bb-grid-size);
        border: 1px solid transparent;
        border-radius: var(--bb-grid-size);
        max-width: 320px;
        min-width: 10%;
        field-sizing: content;
        color: var(--p-0);
        margin-right: var(--bb-grid-size-2);
        outline: none;
        background: transparent;

        &:not([disabled]) {
          &:hover {
            border: 1px solid var(--n-70);
          }

          &:focus {
            border: 1px solid var(--n-50);
          }
        }
      }

      #experiment {
        font-size: 11px;
        line-height: 1;
        padding: var(--bb-grid-size) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-16);
        border: 1px solid var(--n-0);
        margin-left: var(--bb-grid-size-3);
        text-transform: uppercase;
      }

      #back-button {
        padding: 0;
        margin: 0 var(--bb-grid-size-3) 0 0;
        background: none;
        border: none;
        transition: translate 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;

          &:hover {
            translate: -3px 0;
          }
        }
      }
    `,
  ];

  #handleTitleUpdate(evt: Event) {
    const target = evt.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (!target.checkValidity()) {
      target.reportValidity();
      return;
    }

    this.dispatchEvent(new BoardTitleUpdateEvent(target.value));
  }

  #renderTabControls() {
    return html`<section>
      <div id="left">
        <button
          id="back-button"
          @click=${() => {
            this.dispatchEvent(new CloseEvent());
          }}
        >
          <span class="g-icon">arrow_back</span>
        </button>
        <input
          autocomplete="off"
          @blur=${async (evt: Event) => {
            this.#handleTitleUpdate(evt);
          }}
          @keydown=${async (evt: KeyboardEvent) => {
            if (evt.key !== "Enter") {
              return;
            }

            this.#handleTitleUpdate(evt);
          }}
          ?disabled=${!this.canSave ||
          this.saveStatus === BOARD_SAVE_STATUS.SAVING}
          required
          type="text"
          class="sans-flex round w-500"
          id="tab-title"
          .value=${this.tabTitle}
        />
      </div>
      ${this.#renderModeToggle()}
      <div id="right">
        ${[
          this.#renderShareButton(),
          this.#renderRemixButton(),
          this.#renderSaveStatusLabel(),
          this.#renderItemSelect(),
          this.#renderUser(),
        ]}
      </div>
    </section>`;
  }

  #renderModeToggle() {
    return html`<span
      id="mode-toggle"
    >
      <button
        id="app"
        @click=${() => {
          this.dispatchEvent(new ModeToggleEvent("app"));
        }}
        class=${classMap({
          "sans-flex": true,
          round: true,
          "w-500": true,
          "md-body-small": true,
          selected: this.mode === "app",
        })}
        >App</button
      >
      <button
        id="canvas"
        @click=${() => {
          this.dispatchEvent(new ModeToggleEvent("canvas"));
        }}
        class=${classMap({
          "sans-flex": true,
          round: true,
          "w-500": true,
          "md-body-small": true,
          selected: this.mode === "canvas",
        })}
        >Canvas</button
      >
    </button>`;
  }

  #renderItemSelect() {
    const options: EnumValue[] = [
      {
        id: "more",
        title: "",
        icon: "more_vert",
        hidden: true,
      },
    ];
    if (this.isMine) {
      options.push(
        {
          id: "edit-title-and-description",
          title: Strings.from("COMMAND_EDIT_PROJECT_INFORMATION"),
          icon: "edit",
        },
        {
          id: "delete",
          title: Strings.from("COMMAND_DELETE_PROJECT"),
          icon: "delete",
        },
        {
          id: "duplicate",
          title: Strings.from("COMMAND_COPY_PROJECT"),
          icon: "file_copy",
        },
        {
          id: "history",
          title: Strings.from("COMMAND_SHOW_VERSION_HISTORY"),
          icon: "history",
        }
      );
    }

    if (this.hasActiveTab && this.showExperimentalComponents) {
      options.push({
        id: "jump-to-item",
        title: "Jump to Item",
        icon: "jump_to_element",
      });
    }

    options.push({
      id: "feedback",
      title: Strings.from("COMMAND_SEND_FEEDBACK"),
      icon: "flag",
    });

    return html`<bb-item-select
      .showDownArrow=${false}
      .freezeValue=${0}
      .transparent=${true}
      .values=${options}
    ></bb-item-select>`;
  }

  #renderSaveStatusLabel() {
    if (!this.isMine) {
      return nothing;
    }

    let saveStatusLabel;
    switch (this.saveStatus) {
      case BOARD_SAVE_STATUS.UNSAVED: {
        saveStatusLabel = html`Waiting to save...`;
        break;
      }

      case BOARD_SAVE_STATUS.SAVED: {
        saveStatusLabel = html`Saved`;
        break;
      }

      case BOARD_SAVE_STATUS.SAVING: {
        saveStatusLabel = html`Saving...`;
        break;
      }

      case BOARD_SAVE_STATUS.ERROR: {
        saveStatusLabel = html`Unable to save`;
        break;
      }
    }

    return html`<span id="save-status-label" class="sans-flex"
      >${saveStatusLabel}</span
    >`;
  }

  #renderDefaultControls() {
    return html`<section>
      <h1 id="app-title" class="sans-flex round w-500">
        ${Strings.from("APP_NAME")}
        ${Strings.from("PROVIDER_NAME") !== "PROVIDER_NAME" &&
        Strings.from("PROVIDER_NAME") !== ""
          ? html`<span class="sans" id="experiment">Experiment</span>`
          : nothing}
      </h1>
      <div id="right">
        <bb-homepage-search-button></bb-homepage-search-button>
        ${[this.#renderItemSelect(), this.#renderUser()]}
      </div>
    </section>`;
  }

  #renderRemixButton() {
    if (this.isMine) {
      return nothing;
    }

    return html`<button
      id="remix"
      class="sans-flex round w-500"
      @click=${(evt: Event) => {
        if (!(evt.target instanceof HTMLButtonElement)) {
          return;
        }

        evt.target.disabled = true;
        this.dispatchEvent(new RemixEvent());
      }}
    >
      <span class="g-icon">gesture</span>Remix
    </button>`;
  }

  #renderShareButton() {
    if (this.isMine) {
      return nothing;
    }

    return html`<button
      id="share"
      class="sans-flex round w-500"
      @click=${() => {
        this.dispatchEvent(new ShareRequestedEvent());
      }}
    >
      <span class="g-icon">link</span>Share app
    </button>`;
  }

  #renderUser() {
    if (
      !this.signinAdapter ||
      this.signinAdapter.state !== "valid" ||
      !this.signinAdapter.picture
    ) {
      return nothing;
    }

    return html`<button
        id="toggle-user-menu"
        @click=${() => {
          this.#showAccountSwitcher = true;
        }}
      >
        <img
          id="user-pic"
          crossorigin
          .src=${this.signinAdapter.picture}
          alt=${this.signinAdapter.name ?? "No name"}
        />
      </button>
      ${this.#renderAccountSwitcher()}`;
  }

  #renderAccountSwitcher() {
    if (!this.#showAccountSwitcher) {
      return nothing;
    }

    return html`<bb-account-switcher
      id="user-overflow"
      .signInAdapter=${this.signinAdapter}
      @bboverlaydismissed=${() => {
        this.#showAccountSwitcher = false;
      }}
      @bboverflowmenuaction=${() => {
        this.#showAccountSwitcher = false;

        this.dispatchEvent(new SignOutEvent());
      }}
    ></bb-account-switcher>`;
  }

  render() {
    if (this.hasActiveTab) {
      return this.#renderTabControls();
    }

    return this.#renderDefaultControls();
  }
}
