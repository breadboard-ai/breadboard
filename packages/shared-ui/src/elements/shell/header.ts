/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { SigninAdapter } from "../../utils/signin-adapter.js";
import { BOARD_SAVE_STATUS, EnumValue } from "../../types/types.js";
import { icons } from "../../styles/icons.js";
import {
  CloseEvent,
  ShareRequestedEvent,
  SignOutEvent,
  StateEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import { UILoadState } from "../../state/types.js";

@customElement("bb-ve-header")
export class VEHeader extends LitElement {
  @property()
  accessor signinAdapter: SigninAdapter | null = null;

  @property()
  accessor hasActiveTab = false;

  @property()
  accessor tabTitle: string | null = null;

  @property()
  accessor url: string | null = null;

  @property()
  accessor canSave = false;

  @property()
  accessor isMine = false;

  @property()
  accessor showExperimentalComponents = false;

  @property()
  accessor loadState: UILoadState | null = null;

  @property()
  accessor saveStatus: BOARD_SAVE_STATUS | null = null;

  @property()
  accessor mode: "app" | "canvas" = "canvas";

  @property()
  accessor status: "Draft" | "Published" = "Draft";

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
        overflow: hidden;
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
        position: relative;

        & #left {
          display: flex;
          align-items: center;
          padding-right: 160px;
        }

        & #mode-toggle {
          padding: 0;
          margin: 0;
          display: flex;
          gap: var(--bb-grid-size);
          height: var(--bb-grid-size-8);
          position: absolute;
          top: 50%;
          left: max(340px, 50svw);
          translate: -50% -50%;
          border: none;
          background: none;

          & #app,
          & #canvas {
            display: flex;
            align-items: center;

            background: var(--n-90);
            cursor: pointer;
            height: var(--bb-grid-size-8);
            border: none;
            transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:not([disabled]):hover,
            &.selected {
              background: var(--ui-custom-o-25);
            }

            &.selected {
              cursor: auto;
            }
          }

          & #app {
            padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-4);
            border-radius: var(--bb-grid-size-16) var(--bb-grid-size-5)
              var(--bb-grid-size-5) var(--bb-grid-size-16);
          }

          & #canvas {
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
            border-radius: var(--bb-grid-size-5) var(--bb-grid-size-16)
              var(--bb-grid-size-16) var(--bb-grid-size-5);
          }
        }

        & #right {
          display: flex;
          align-items: center;

          bb-homepage-search-button {
            margin: 0 var(--bb-grid-size-6) 0 0;
          }

          bb-item-select {
            --selected-item-padding-left: var(--bb-grid-size);
            --selected-item-padding-right: var(--bb-grid-size);
            --selected-item-hover-color: var(--n-95);
            --selected-item-border-radius: 50%;

            margin: 0 0 0 var(--bb-grid-size-3);
          }

          & #save-status-label {
            display: none;
            font-size: 10px;
            line-height: 1;
            color: var(--ui-secondary-text);
            margin: 0 0 0 var(--bb-grid-size-4);
            min-width: 45px;
          }

          & #toggle-user-menu {
            height: var(--bb-grid-size-7);
            padding: 0;
            margin: 0 0 0 var(--bb-grid-size-4);
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

          & #publish,
          & #remix {
            display: none;
            align-items: center;
            background: var(--n-0);
            border: none;
            border-radius: var(--bb-grid-size-16);
            margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-6);

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

        &#app-title {
          font-size: 26px;
        }
      }

      #tab-title {
        font-size: 16px;
        padding: var(--bb-grid-size) var(--bb-grid-size);
        border: 1px solid transparent;
        border-radius: var(--bb-grid-size);
        max-width: 200px;
        min-width: 10%;
        field-sizing: content;
        color: var(--p-0);
        margin-right: var(--bb-grid-size-2);
        outline: none;
        background: transparent;

        &[disabled] {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

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
        display: none;
        font-size: 11px;
        line-height: 1;
        padding: var(--bb-grid-size) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-16);
        border: 1px solid var(--n-0);
        text-transform: uppercase;
      }

      #status {
        display: none;
        align-items: center;
        font-size: 10px;
        margin-left: var(--bb-grid-size-3);
        color: var(--n-10);

        & .g-icon {
          margin-right: var(--bb-grid-size);
        }
      }

      #app-title #experiment {
        margin-left: var(--bb-grid-size-2);
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

      @media (min-width: 620px) {
        section #right #save-status-label {
          display: block;
        }
      }

      @media (min-width: 820px) {
        #experiment {
          display: block;
        }
      }

      @media (min-width: 830px) {
        section #right #publish,
        section #right #remix {
          display: flex;
        }
      }

      @media (min-width: 980px) {
        #status {
          display: flex;
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

    this.dispatchEvent(
      new StateEvent({
        eventType: "board.rename",
        title: target.value,
        description: null,
      })
    );
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
        ${this.#renderExperimentalLabel()} ${this.#renderStatusLabel()}
      </div>
      ${this.#renderModeToggle()}
      <div id="right">
        ${[
          this.#renderSaveStatusLabel(),
          this.#renderSharePublishButton(),
          this.#renderRemixButton(),
          this.#renderGraphItemSelect(),
          this.#renderGlobalItemSelect(),
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
          this.dispatchEvent(
            new StateEvent({ eventType: "host.modetoggle", mode: "app" })
          );
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
          this.dispatchEvent(
            new StateEvent({ eventType: "host.modetoggle", mode: "canvas" })
          );
        }}
        class=${classMap({
          "sans-flex": true,
          round: true,
          "w-500": true,
          "md-body-small": true,
          selected: this.mode === "canvas",
        })}
        >Editor</button
      >
    </button>`;
  }

  #renderGraphItemSelect() {
    if (!this.isMine) {
      return nothing;
    }

    const options: EnumValue[] = [
      {
        id: "more",
        title: "",
        icon: "more_vert",
        hidden: true,
      },
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
      },
    ];

    if (this.showExperimentalComponents) {
      options.push({
        id: "copy-board-contents",
        title: Strings.from("COMMAND_COPY_PROJECT_CONTENTS"),
        icon: "content_copy",
      });
    }

    return html`<bb-item-select
      .showDownArrow=${false}
      .freezeValue=${0}
      .transparent=${true}
      .values=${options}
    ></bb-item-select>`;
  }

  #renderGlobalItemSelect() {
    const options: EnumValue[] = [
      {
        id: "settings",
        title: "",
        icon: "settings",
        hidden: true,
      },
      {
        id: "feedback",
        title: Strings.from("COMMAND_SEND_FEEDBACK"),
        icon: "flag",
      },
      {
        id: "chat",
        title: Strings.from("COMMAND_JOIN_CHAT"),
        icon: "open_in_new",
      },
      {
        id: "demo-video",
        title: Strings.from("COMMAND_WATCH_DEMO_VIDEO"),
        icon: "videocam",
      },
    ];

    if (this.showExperimentalComponents) {
      options.push({
        id: "show-runtime-flags",
        title: "Show Experiments",
        icon: "experiment",
      });
    }

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

  #renderExperimentalLabel() {
    return html`${Strings.from("PROVIDER_NAME") !== "PROVIDER_NAME" &&
    Strings.from("PROVIDER_NAME") !== ""
      ? html`<span class="sans" id="experiment">Experiment</span>`
      : nothing}`;
  }

  #renderStatusLabel() {
    return html`<span class="sans" id="status"
      >${this.status === "Published"
        ? html`<span class="g-icon w-400">cloud_done</span>`
        : nothing}${this.status}</span
    >`;
  }

  #renderDefaultControls() {
    return html`<section>
      <h1 id="app-title" class="sans-flex round w-500">
        ${Strings.from("APP_NAME")} ${this.#renderExperimentalLabel()}
      </h1>
      ${this.loadState !== "Error" && this.loadState !== "Loading"
        ? html`<div id="right">
            <bb-homepage-search-button></bb-homepage-search-button>
            ${[this.#renderGraphItemSelect(), this.#renderUser()]}
          </div>`
        : nothing}
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

        if (!this.url) {
          return;
        }

        evt.target.disabled = true;
        this.dispatchEvent(
          new StateEvent({
            eventType: "board.remix",
            url: this.url,
            messages: {
              start: Strings.from("STATUS_REMIXING_PROJECT"),
              end: Strings.from("STATUS_PROJECT_CREATED"),
              error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
            },
          })
        );
      }}
    >
      <span class="g-icon">gesture</span>Remix
    </button>`;
  }

  #renderSharePublishButton() {
    if (this.isMine) {
      return html`<button
        id="publish"
        class="sans-flex round w-500"
        @click=${() => {
          this.dispatchEvent(new ShareRequestedEvent());
        }}
      >
        <span class="g-icon">share</span>Share app
      </button>`;
    }

    return html`<button
      id="share"
      class="sans-flex round w-500"
      @click=${() => {
        this.dispatchEvent(new ShareRequestedEvent());
      }}
    >
      <span class="g-icon">share</span>Share app
    </button>`;
  }

  #renderUser() {
    if (
      !this.signinAdapter ||
      this.signinAdapter.state !== "signedin" ||
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

  protected willUpdate(changedProperties: PropertyValues): void {
    // If the user has opened a file that isn't theirs it must be Published, so
    // we update the status as such.
    if (changedProperties.has("isMine")) {
      this.status = this.isMine ? "Draft" : "Published";
    }
  }

  render() {
    if (this.hasActiveTab) {
      return this.#renderTabControls();
    }

    return this.#renderDefaultControls();
  }
}
