/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { discordIcon } from "../../styles/svg-icons.js";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import {
  CloseEvent,
  HideTooltipEvent,
  OverflowMenuActionEvent,
  ShareRequestedEvent,
  ShowTooltipEvent,
  SignOutEvent,
  StateEvent,
} from "../../events/events.js";
import { UILoadState } from "../../../sca/types.js";
import type { GraphContentState } from "../../../sca/controller/subcontrollers/editor/graph/graph-controller.js";
import * as Styles from "../../styles/styles.js";
import { BOARD_SAVE_STATUS, EnumValue } from "../../types/types.js";
import { SigninAdapter } from "../../utils/signin-adapter.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { until } from "lit/directives/until.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../config/client-deployment-configuration.js";

@customElement("bb-ve-header")
export class VEHeader extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor signinAdapter: SigninAdapter | null = null;

  get hasActiveTab() {
    return this.sca.controller.editor.graph.graph !== null;
  }

  get tabTitle(): string | null {
    return this.sca.controller.editor.graph.title ?? null;
  }

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

  @property()
  accessor graphContentState: GraphContentState = "loading";

  @state()
  accessor #showAccountSwitcher = false;

  static styles = [
    Styles.HostType.type,
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostColorScheme.match,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        scrollbar-width: none;
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
        background: light-dark(var(--n-100), var(--n-15));
        border-bottom: 1px solid var(--light-dark-n-90);
        padding: 0 var(--bb-grid-size-5);
        scrollbar-width: none;
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

            color: var(--light-dark-n-0);
            background: var(--light-dark-n-95);
            cursor: pointer;
            height: var(--bb-grid-size-8);
            border: none;
            transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:not([disabled]):not(.selected):hover {
              background: light-dark(
                var(--ui-custom-o-5),
                var(--ui-custom-o-5)
              );
            }

            &.selected {
              cursor: auto;
              background: light-dark(
                var(--ui-custom-o-25),
                var(--ui-custom-o-25)
              );
              outline: 1px solid var(--ui-custom-o-100);
            }
          }

          & #canvas {
            padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-4);
            border-radius: var(--bb-grid-size-16) var(--bb-grid-size-5)
              var(--bb-grid-size-5) var(--bb-grid-size-16);
          }

          & #app {
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
            border-radius: var(--bb-grid-size-5) var(--bb-grid-size-16)
              var(--bb-grid-size-16) var(--bb-grid-size-5);
          }
        }

        & #right {
          display: flex;
          align-items: center;

          bb-expanding-search-button {
            margin: 0 var(--bb-grid-size-6) 0 0;
          }

          bb-item-select {
            --selected-item-padding-left: var(--bb-grid-size);
            --selected-item-padding-right: var(--bb-grid-size);
            --selected-item-hover-color: light-dark(var(--n-95), var(--n-30));
            --selected-item-border-radius: 50%;

            margin: 0 0 0 var(--bb-grid-size-3);
          }

          & #save-status-label {
            font-size: 10px;
            line-height: 1;
            color: light-dark(var(--n-0), var(--n-70));
            margin: 0 0 0 var(--bb-grid-size-4);
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
            & #user-pic-unknown {
              display: flex;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              background-color: lightgray;
              padding: 2px;
              width: var(--bb-grid-size-7);
              height: var(--bb-grid-size-7);
            }
          }

          & #share-button {
            display: none;
            align-items: center;
            background: var(--light-dark-n-100);
            border: 1px solid var(--light-dark-n-95);
            border-radius: var(--bb-grid-size-16);
            margin: 0 0 0 var(--bb-grid-size-6);
            color: var(--light-dark-n-0);
            height: var(--bb-grid-size-8);
            padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
            font-size: 12px;
            transition:
              background 0.2s cubic-bezier(0, 0, 0.2, 1),
              border 0.2s cubic-bezier(0, 0, 0.2, 1);

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
            }

            &:not([disabled]) {
              cursor: pointer;

              &:hover {
                border: 1px solid var(--light-dark-n-80);
              }
            }

            &.owner {
              background: light-dark(var(--n-0), var(--n-25));
              border: 1px solid transparent;
              color: light-dark(var(--n-100), var(--n-90));
              margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-6);

              &:not([disabled]):hover {
                background: light-dark(var(--n-25), var(--n-35));
                border: 1px solid transparent;
              }
            }

            &.sharing-v2 {
              border-radius: 100px;
              font-size: 14px;
            }
          }

          & #remix {
            display: none;
            align-items: center;
            background: var(--light-dark-n-0);
            border: none;
            border-radius: var(--bb-grid-size-16);
            margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-6);
            color: var(--light-dark-n-100);
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
                background: light-dark(var(--n-25), var(--n-90));
              }
            }
          }

          & #publish-button {
            display: none;
            margin: 0 0 0 var(--bb-grid-size-2);
          }

          & #remix {
            position: relative;
          }
        }
      }

      h1,
      #tab-title {
        margin: 0;
        line-height: 1;
        color: light-dark(var(--n-0), var(--n-90));
        display: flex;
        align-items: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

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
        color: light-dark(var(--n-0), var(--n-90));
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
            border: 1px solid var(--light-dark-n-70);
          }

          &:focus {
            border: 1px solid var(--light-dark-n-50);
          }
        }
      }

      #experiment {
        display: none;
        font-size: 11px;
        line-height: 1;
        padding: var(--bb-grid-size) var(--bb-grid-size-3);
        border-radius: var(--bb-grid-size-16);
        border: 1px solid light-dark(var(--n-0), var(--n-70));
        text-transform: uppercase;
        color: light-dark(var(--n-0), var(--n-70));

        &.has-overrides {
          cursor: pointer;
          border: none;
          padding: var(--bb-grid-size) var(--bb-grid-size-2);
          background-color: light-dark(var(--e-95), var(--e-15));
          color: light-dark(var(--e-20), var(--e-70));
          font-weight: 500;
          font-family: Google Sans Code;
        }
      }

      #status {
        display: none;
        align-items: center;
        font-size: 10px;
        margin-left: var(--bb-grid-size-3);
        color: var(--light-dark-n-10);

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
        color: var(--light-dark-n-0);
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

      @media (max-width: 620px) {
        section {
          #left {
            padding-right: 0;
          }
          #tab-title {
            display: none;
          }
          #mode-toggle {
            left: 50%;
          }
          :host([hasactivetab]) & #global-item-select {
            display: none;
          }
          #right #save-status-label {
            display: none;
          }
        }
      }

      @media (min-width: 830px) {
        #experiment {
          display: block;
        }
        section #right {
          #remix,
          #share-button,
          #publish-button {
            display: flex;
          }
        }
      }

      #mode-toggle,
      #remix,
      #share-button {
        animation: fadeIn 0.15s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (min-width: 980px) {
        #status {
          display: flex;
        }
      }
    `,
  ];

  constructor() {
    super();
  }

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
          this.#renderPublishButton(),
          this.#renderShareButton(),
          this.#renderRemixButton(),
          this.#renderGraphItemSelect(),
          this.#renderGlobalItemSelect(),
          this.#renderUser(),
        ]}
      </div>
    </section>`;
  }

  #renderModeToggle() {
    // Hide the mode toggle only when the graph is genuinely empty.
    // During "loading", we still show the toggle to avoid a flash.
    if (this.graphContentState === "empty") {
      return nothing;
    }
    const share = this.sca.controller.editor.share;
    if (
      !this.isMine &&
      // Always hide the mode toggle (as well as the share and remix buttons below)
      // while sharing is initializing, so that there's no flash if it turns out
      // viewerMode=app-only. Instead, they will fade in (or not) after sharing
      // is initialized.
      (share.status === "initializing" || share.viewerMode === "app-only")
    ) {
      return nothing;
    }
    return html`<span id="mode-toggle">
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
      >
        Editor
      </button>
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
      >
        App
      </button>
    </span>`;
  }

  #renderGraphItemSelect() {
    const options: EnumValue[] = [
      {
        id: "more",
        title: "",
        icon: "more_vert",
        hidden: true,
      },
    ];

    const screenSize = this.sca.controller.global.screenSize.size;
    // On medium and smaller screens (≤830px), the share/remix buttons are hidden via CSS,
    // so include those options here
    if (screenSize !== "wide") {
      if (!this.isMine) {
        options.push({
          id: "remix",
          title: "Remix",
          icon: "gesture",
        });
      }
      options.push({
        id: "share",
        title: Strings.from("COMMAND_COPY_APP_PREVIEW_URL"),
        icon: "share",
      });
    }

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
        }
      );

      // Version history is in the console view, so we don't currently
      // have a mobile view for it
      if (screenSize !== "narrow") {
        options.push({
          id: "history",
          title: Strings.from("COMMAND_SHOW_VERSION_HISTORY"),
          icon: "history",
        });
      }

      options.push({
        id: "copy-board-contents",
        title: Strings.from("COMMAND_COPY_PROJECT_CONTENTS"),
        icon: "content_copy",
      });
    }

    // On narrow screens (≤600px), the global item select is hidden via CSS,
    // so include those options here
    if (screenSize === "narrow") {
      options.push(...this.#globalItemSelectOptions);
    }

    // Only show the menu if there are items beyond the hidden "more" button
    if (options.length <= 1) {
      return nothing;
    }

    return html`<bb-item-select
      .showDownArrow=${false}
      .freezeValue=${0}
      .transparent=${true}
      .values=${options}
    ></bb-item-select>`;
  }

  #globalItemSelectOptions: EnumValue[] = [
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
      id: "documentation",
      title: Strings.from("COMMAND_DOCUMENTATION"),
      icon: "quick_reference_all",
    },
    {
      id: "status-update",
      title: Strings.from("COMMAND_STATUS_UPDATE"),
      icon: "bigtop_updates",
    },
    {
      id: "chat",
      title: Strings.from("COMMAND_JOIN_CHAT"),
      icon: discordIcon,
    },
    {
      id: "show-global-settings",
      title: Strings.from("COMMAND_GLOBAL_SETTINGS"),
      icon: "settings_2",
    },
    {
      id: "demo-video",
      title: Strings.from("COMMAND_WATCH_DEMO_VIDEO"),
      icon: "videocam",
    },
  ];

  #renderGlobalItemSelect() {
    return html`<bb-item-select
      id="global-item-select"
      .showDownArrow=${false}
      .freezeValue=${0}
      .transparent=${true}
      .values=${this.#globalItemSelectOptions}
    ></bb-item-select>`;
  }

  #renderSaveStatusLabel() {
    if (!this.isMine) {
      return nothing;
    }

    let saveStatusLabel;
    switch (this.saveStatus) {
      case BOARD_SAVE_STATUS.UNSAVED:
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
    const hasOverrides = this.sca.env.flags.overrides().then((overrides) => {
      const count = Object.keys(overrides).length;

      if (
        Strings.from("PROVIDER_NAME") === "PROVIDER_NAME" ||
        Strings.from("PROVIDER_NAME") === ""
      ) {
        return nothing;
      }

      return html`<span
        class="sans ${count > 0 ? "has-overrides" : ""}"
        id="experiment"
        .aria-role=${count > 0 ? "button" : nothing}
        @pointerover=${(evt: PointerEvent) => {
          if (count <= 0) {
            return;
          }

          this.dispatchEvent(
            new ShowTooltipEvent(
              Strings.from("TEXT_EXPERIMENT_MODE")
                .replace("{{count}}", count.toString())
                .replace("{{suffix}}", count === 1 ? "" : "s"),
              evt.clientX,
              evt.clientY + 90,
              { status: false, isMultiLine: true }
            )
          );
        }}
        @pointerout=${() => {
          if (count <= 0) {
            return;
          }

          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          if (count <= 0) {
            return;
          }

          this.sca.controller.global.main.globalSettingsTab = "EXPERIMENTAL";
          this.sca.controller.global.main.show.add("GlobalSettings");
        }}
        >${count > 0 ? "Experiment mode" : "Experiment"}</span
      >`;
    });

    return html`${until(hasOverrides, nothing)}`;
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
            ${[this.#renderGlobalItemSelect(), this.#renderUser()]}
          </div>`
        : nothing}
    </section>`;
  }

  #renderRemixButton() {
    if (this.isMine) {
      return nothing;
    }
    const share = this.sca.controller.editor.share;
    if (share.status === "initializing" || share.viewerMode === "app-only") {
      return nothing;
    }

    return html`<button
      id="remix"
      class="sans-flex"
      @click=${() => {
        if (!this.url) {
          return;
        }

        this.sca?.services.actionTracker?.remixApp(this.url, "editor");
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
      <span class="g-icon">gesture</span>
      <span class="round w-500">Remix</span>

      ${html`<bb-onboarding-tooltip
        delayed
        .onboardingId=${"standalone-remix"}
      ></bb-onboarding-tooltip>`}
    </button> `;
  }

  #renderPublishButton() {
    if (!this.isMine || !CLIENT_DEPLOYMENT_CONFIG.ENABLE_SHARING_2) {
      return nothing;
    }
    return html`<bb-publish-button id="publish-button"></bb-publish-button>`;
  }

  #renderShareButton() {
    const share = this.sca.controller.editor.share;
    if (!this.isMine && share.status === "initializing") {
      return nothing;
    }
    const label = CLIENT_DEPLOYMENT_CONFIG.ENABLE_SHARING_2
      ? "Share"
      : Strings.from("COMMAND_COPY_APP_PREVIEW_URL");
    return html`<button
      id="share-button"
      class=${classMap({
        "sans-flex": true,
        round: true,
        "w-500": true,
        owner: !!this.isMine,
        "sharing-v2": !!CLIENT_DEPLOYMENT_CONFIG.ENABLE_SHARING_2,
      })}
      @click=${() => {
        this.dispatchEvent(new ShareRequestedEvent());
      }}
    >
      <span class="g-icon">share</span>${label}
    </button>`;
  }

  #renderUser() {
    if (
      !this.signinAdapter ||
      this.signinAdapter.stateSignal?.status !== "signedin"
    ) {
      return nothing;
    }
    const name = this.signinAdapter.nameSignal;
    const picture = this.signinAdapter.pictureSignal;

    return html`<button
        id="toggle-user-menu"
        @click=${() => {
          this.#showAccountSwitcher = true;
        }}
      >
        ${picture
          ? html`<img
              id="user-pic"
              crossorigin
              .src=${picture}
              alt=${name ?? "No name"}
            />`
          : // For unknown reasons, the token info may not include a `picture` URL or `name`.
            // Since we use the avatar as a button to access the menu, we render an icon in
            // place of user picture if it's not available.
            html`<span id="user-pic-unknown" class="g-icon filled"
              >person</span
            >`}
      </button>
      ${this.#renderAccountSwitcher()}`;
  }

  #createUserSuffix(authuser = 0) {
    let userSuffix = "";
    if (authuser !== 0) {
      userSuffix = `/u/${authuser + 1}`;
    }

    return userSuffix;
  }

  #createMembershipUrl(authuser = 0) {
    const userSuffix = this.#createUserSuffix(authuser);
    return `https://one.google.com${userSuffix}/settings?utm_source=opal&utm_medium=web&utm_campaign=opal_manage_membership`;
  }

  #createAICreditsUrl(authuser = 0) {
    const userSuffix = this.#createUserSuffix(authuser);
    return `https://one.google.com${userSuffix}/ai/credits?utm_source=opal&utm_medium=web&utm_campaign=opal_account_menu_add_credits`;
  }

  #getAuthUser() {
    let authUser = 0;
    if (this.sca.services.signinAdapter.stateSignal?.status === "signedin") {
      const { authuser } = this.sca.services.signinAdapter.stateSignal;
      if (authuser) {
        authUser = Number.parseInt(authuser, 10);
        if (Number.isNaN(authUser)) {
          authUser = 0;
        }
      }
    }

    return authUser;
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
      @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
        this.#showAccountSwitcher = false;

        switch (evt.action) {
          case "logout": {
            this.dispatchEvent(new SignOutEvent());
            break;
          }

          case "manage-membership": {
            const url = this.#createMembershipUrl(this.#getAuthUser());
            window.open(url, "_blank", "noopener,noreferrer");
            break;
          }

          case "get-ai-credits": {
            const url = this.#createAICreditsUrl(this.#getAuthUser());
            window.open(url, "_blank", "noopener,noreferrer");
            break;
          }

          default: {
            console.log("Action: ", evt.action);
            break;
          }
        }
      }}
    ></bb-account-switcher>`;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    // Sync hasactivetab attribute for CSS :host([hasactivetab]) selector
    this.toggleAttribute("hasactivetab", this.hasActiveTab);

    // If the user has opened a file that isn't theirs it must be Published, so
    // we update the status as such.
    if (changedProperties.has("isMine")) {
      this.status = this.isMine ? "Draft" : "Published";
    }
  }

  render() {
    const isHydrated = this.sca.env.flags.hydrated;
    if (!isHydrated) {
      return nothing;
    }

    if (this.hasActiveTab) {
      return this.#renderTabControls();
    }

    return this.#renderDefaultControls();
  }
}
