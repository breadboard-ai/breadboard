/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { isCtrlCommand } from "../../input/is-ctrl-command.js";
import {
  StateEvent,
  ShowTooltipEvent,
  HideTooltipEvent,
  ShareRequestedEvent,
  SignOutEvent,
  OverflowMenuActionEvent,
} from "../../events/events.js";
import * as Styles from "../../styles/styles.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import * as Theme from "../../../theme/index.js";
import {
  extractPromptText,
  parsePrompt,
  promptToBlocks,
} from "../../../utils/prompt-utils.js";
import { BOARD_SAVE_STATUS, EnumValue } from "../../types/types.js";
import {
  createAICreditsUrl,
  createMembershipUrl,
} from "../../../sca/utils/google-one-urls.js";
import { discordIcon } from "../../styles/svg-icons.js";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import "../shared/agent-avatar.js";
import "../input/text-editor/text-editor-remix.js";
import "./asset-shelf/asset-shelf.js";
import "./tool-shelf/tool-shelf.js";

@customElement("bb-agent-config-column")
export class AgentConfigColumn extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

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
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: var(--light-dark-n-100);
        box-sizing: border-box;
        position: relative;
      }

      /* ── Column Header ── */
      #column-header {
        position: relative;
        z-index: 4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 56px;
        flex: 0 0 auto;
        padding: 0 var(--bb-grid-size-5);
        background: var(--light-dark-n-100);
      }

      #header-scrim {
        position: absolute;
        background: linear-gradient(
          var(--light-dark-n-100) 0%,
          transparent 100%
        );
        width: calc(100% - 64px);
        height: 12px;
        left: 32px;
        top: 56px;
        z-index: 3;
      }

      #header-left {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-6);
      }

      #save-status-container {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);
        color: var(--light-dark-n-50);
        font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
          var(--bb-font-family);
      }

      #save-status-label {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size);
        color: var(--light-dark-n-50);
      }

      #save-status-label .g-icon {
        font-size: 16px;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .spinning {
        animation: spin 1s linear infinite;
        display: inline-block;
      }

      #draft-status {
        color: var(--light-dark-n-50);
      }

      .dot {
        color: var(--light-dark-n-70);
      }

      #experiment {
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

      #header-right {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-2);

        bb-item-select {
          --selected-item-padding-left: var(--bb-grid-size);
          --selected-item-padding-right: var(--bb-grid-size);
          --selected-item-hover-color: light-dark(var(--n-95), var(--n-30));
          --selected-item-border-radius: 50%;
        }
      }

      #share-button {
        display: flex;
        align-items: center;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-95);
        border-radius: 100px;
        color: var(--light-dark-n-0);
        height: var(--bb-grid-size-8);
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
        font-size: 14px;
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

          &:not([disabled]):hover {
            background: light-dark(var(--n-25), var(--n-35));
            border: 1px solid transparent;
          }
        }
      }

      #toggle-user-menu {
        height: var(--bb-grid-size-7);
        padding: 0;
        margin: 0;
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
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background-color: lightgray;
          padding: 2px;
          width: var(--bb-grid-size-7);
          height: var(--bb-grid-size-7);
        }
      }

      #account-switcher-placeholder {
        width: var(--bb-grid-size-7);
        height: var(--bb-grid-size-7);
      }

      /* ── Scrollable content area ── */
      .config-scroll {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        padding: 80px 120px 80px 160px;
      }

      .config-container {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-10); /* 40px gap */
        max-width: 960px;
        margin: 0 auto;
      }

      .avatar-section {
        display: flex;
        align-items: center;
      }

      bb-agent-avatar {
        --avatar-bg: var(--light-dark-s-60);
      }

      .heading-section {
        & h1 {
          margin: 0;
          font-family: "Google Sans Flex", sans-serif;
          font-size: 32px;
          font-weight: 400;
          line-height: 40px;
          color: var(--light-dark-n-10);
          outline: none;
          border: 1px solid transparent;
          border-radius: var(--bb-grid-size);
          padding: var(--bb-grid-size) 0;
          cursor: text;
          min-height: 40px;

          &:hover,
          &:focus {
            border-color: var(--light-dark-n-90);
          }
        }
      }

      .instructions-section {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-3);

        & h3 {
          margin: 0;
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--light-dark-n-20);
        }
      }

      bb-text-editor-remix {
        --text-editor-font: 400 16px/24px
          var(--bb-font-family-flex, "Google Sans Flex", sans-serif);
        --text-editor-color: var(--Neutral-700, #5f6368);
        --text-editor-font-feature-settings: "ss02" on;
        --text-editor-line-height: 24px;
        --text-editor-padding-top: 0;
        --text-editor-padding-right: 0;
        --text-editor-padding-bottom: 0;
        --text-editor-padding-left: 0;
        border: none;
        background: transparent;
        width: 100%;
      }

      .divider {
        height: 1px;
        background: var(--light-dark-n-90);
        width: 100%;
      }

      bb-account-switcher {
        position: fixed;
      }
    `,
  ];

  // ── Header state helpers ──

  get isMine() {
    const url = this.sca.controller.editor.graph.url;
    return url
      ? this.sca.services.googleDriveBoardServer.isMine(new URL(url))
      : false;
  }

  get canSave() {
    const gc = this.sca.controller.editor.graph;
    let canSave = false;
    if (gc.graph && !gc.readOnly) {
      const graphUrl = gc.url;
      if (graphUrl) {
        const boardServer = this.sca.services.googleDriveBoardServer;
        const capabilities = boardServer?.canProvide(new URL(graphUrl));
        canSave = capabilities !== false && !!capabilities?.save;
      }
    }
    return canSave;
  }

  get saveStatus() {
    const gc = this.sca.controller.editor.graph;
    if (!gc.graph) {
      return BOARD_SAVE_STATUS.ERROR;
    }
    const status = gc.saveStatus;
    switch (status) {
      case "saving":
        return BOARD_SAVE_STATUS.SAVING;
      case "saved":
        return BOARD_SAVE_STATUS.SAVED;
      case "unsaved":
        return BOARD_SAVE_STATUS.UNSAVED;
      case "error":
        return BOARD_SAVE_STATUS.ERROR;
      default:
        return BOARD_SAVE_STATUS.ERROR;
    }
  }

  get status() {
    return this.isMine ? "Draft" : "Published";
  }

  // ── Text editor state ──

  /**
   * True while the inner text editor has focus. While focused, the text
   * editor owns its internal state — we must not re-set `.value` from the
   * graph or the cursor position and in-progress edits will be clobbered.
   */
  #focused = false;

  #onFocus() {
    this.#focused = true;
  }

  #onBlur(evt: FocusEvent & { currentTarget: HTMLInputElement }) {
    this.#focused = false;
    const blocks = promptToBlocks({
      role: "user",
      parts: [{ text: evt.currentTarget.value }],
    });
    this.sca.actions.workbench.applyObjective(blocks);
  }

  #onKeyDown(evt: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (isCtrlCommand(evt) && evt.key === "Enter") {
      evt.preventDefault();
      const blocks = promptToBlocks({
        role: "user",
        parts: [{ text: evt.currentTarget.value }],
      });
      // Mirror the blur handler: release ownership before the graph
      // update so the re-render passes the real objectiveText (not
      // `nothing`, which Lit resolves to `undefined` and wipes the
      // editor model).
      this.#focused = false;
      this.sca.actions.workbench.applyObjective(blocks);
    }
  }

  #onHeadingBlur(evt: FocusEvent & { target: HTMLHeadingElement }) {
    const newTitle = evt.target.textContent?.trim() || "";
    const currentTitle = this.sca.controller.editor.graph.title;
    if (newTitle === "" || newTitle === currentTitle) {
      return;
    }
    this.dispatchEvent(
      new StateEvent({
        eventType: "board.rename",
        title: newTitle,
        description: null,
      })
    );
  }

  #onHeadingKeyDown(evt: KeyboardEvent & { target: HTMLHeadingElement }) {
    if (evt.key === "Enter") {
      evt.preventDefault();
      evt.target.blur();
    }
  }

  // ── Header render helpers ──

  #renderPublishButton() {
    if (!this.isMine) {
      return nothing;
    }
    return html`<bb-publish-button id="publish-button"></bb-publish-button>`;
  }

  #renderSaveStatusLabel() {
    if (!this.isMine) {
      return nothing;
    }

    let icon = "";
    let label = "";
    switch (this.saveStatus) {
      case BOARD_SAVE_STATUS.UNSAVED:
      case BOARD_SAVE_STATUS.SAVED: {
        icon = "cloud_done";
        label = "Saved";
        break;
      }

      case BOARD_SAVE_STATUS.SAVING: {
        icon = "sync";
        label = "Saving...";
        break;
      }

      case BOARD_SAVE_STATUS.ERROR: {
        icon = "cloud_off";
        label = "Unable to save";
        break;
      }
    }

    return html`<span id="save-status-label" class="sans-flex">
      <span
        class="g-icon ${this.saveStatus === BOARD_SAVE_STATUS.SAVING
          ? "spinning"
          : ""}"
        >${icon}</span
      >
      <span>${label}</span>
    </span>`;
  }

  #renderExperimentalLabel({ overridesOnly = false } = {}) {
    const hasOverrides = this.sca.env.flags.overrides().then((overrides) => {
      const count = Object.keys(overrides).length;

      if (overridesOnly && count <= 0) {
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

  #renderShareButton() {
    const share = this.sca.controller.editor.share;
    if (!this.isMine && share.status === "initializing") {
      return nothing;
    }
    return html`<button
      id="share-button"
      class=${classMap({
        "sans-flex": true,
        round: true,
        "w-500": true,
        owner: !!this.isMine,
        "sharing-v2": true,
      })}
      @mouseenter=${() => this.sca.actions.share.flushSave()}
      @click=${() => {
        this.dispatchEvent(new ShareRequestedEvent());
      }}
    >
      <span class="g-icon">share</span>Share
    </button>`;
  }

  #renderThreeDotMenu() {
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
        {
          id: "copy-board-contents",
          title: Strings.from("COMMAND_COPY_PROJECT_CONTENTS"),
          icon: "content_copy",
        }
      );
    }

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

  #renderSettingsCog() {
    const settingsOptions: EnumValue[] = [
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

    return html`<bb-item-select
      id="global-item-select"
      .showDownArrow=${false}
      .freezeValue=${0}
      .transparent=${true}
      .values=${settingsOptions}
    ></bb-item-select>`;
  }

  #renderUser() {
    const signinAdapter = this.sca.services.signinAdapter;
    if (!signinAdapter || signinAdapter.stateSignal?.status !== "signedin") {
      return nothing;
    }
    if (this.sca.env.guestConfig.hostRendersAccountSwitcher) {
      return html`<div id="account-switcher-placeholder"></div>`;
    }
    const name = signinAdapter.nameSignal;
    const picture = signinAdapter.pictureSignal;

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
          : html`<span id="user-pic-unknown" class="g-icon filled"
              >person</span
            >`}
      </button>
      ${this.#renderAccountSwitcher()}`;
  }

  #renderAccountSwitcher() {
    if (!this.#showAccountSwitcher) {
      return nothing;
    }

    return html`<bb-account-switcher
      id="user-overflow"
      .signInAdapter=${this.sca.services.signinAdapter}
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
            const authuser = this.sca.services.signinAdapter.authuserSignal;
            const url = createMembershipUrl(authuser);
            window.open(url, "_blank", "noopener,noreferrer");
            break;
          }

          case "get-ai-credits": {
            const authuser = this.sca.services.signinAdapter.authuserSignal;
            const url = createAICreditsUrl(
              authuser,
              "account_menu_add_credits"
            );
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

  render() {
    const graphController = this.sca?.controller?.editor?.graph;
    if (!graphController) return nothing;

    // Re-render when graph changes to ensure the correct prompt/title is rendered.
    void graphController.version;

    const graph = graphController.graph;
    const agentNode = graph.nodes?.find(
      (n) => n.configuration?.["generation-mode"] === "agent"
    );
    if (!agentNode) return nothing;

    const config = agentNode.configuration ?? {};
    const rawPrompt = extractPromptText(config["config$prompt"]);
    // Show only the objective text — tool placeholders are managed
    // independently by the tool shelf.
    const { objectiveText } = parsePrompt(rawPrompt);

    // While focused, don't pass .value — the text editor owns its
    // internal state and re-setting it would clobber the cursor and
    // any in-progress edits.
    const editorValue = this.#focused ? nothing : objectiveText;
    const title = graphController.title ?? "Untitled agent";

    // Dynamically resolve theme colors from the graph's visual metadata
    let themeStyles: Record<string, string> = {};
    if (
      graphController.graph?.metadata?.visual?.presentation?.themes &&
      graphController.graph?.metadata?.visual?.presentation?.theme
    ) {
      const theme = graphController.graph.metadata.visual.presentation.theme;
      const themes = graphController.graph.metadata.visual.presentation.themes;

      if (themes[theme]) {
        const appPalette = themes[theme].palette;
        if (appPalette) {
          themeStyles = Theme.createThemeStyles(
            appPalette,
            Theme.appColorMapping
          );
        }
      }
    }

    return html`
      <div id="column-header">
        <div id="header-left">
          ${this.#renderExperimentalLabel()}
          <div id="save-status-container">
            ${this.#renderSaveStatusLabel()}
            <span class="dot">•</span>
            <span id="draft-status">${this.status}</span>
          </div>
        </div>

        <div id="header-right">
          ${this.#renderPublishButton()} ${this.#renderShareButton()}
          ${this.#renderThreeDotMenu()} ${this.#renderSettingsCog()}
          ${this.#renderUser()}
        </div>
      </div>

      <div id="header-scrim"></div>

      <div class="config-scroll">
        <div class="config-container" style=${styleMap(themeStyles)}>
          <div class="avatar-section">
            <bb-agent-avatar
              mode="large"
              .supportsHover=${false}
            ></bb-agent-avatar>
          </div>

          <div class="heading-section">
            <h1
              contenteditable="true"
              @blur=${this.#onHeadingBlur}
              @keydown=${this.#onHeadingKeyDown}
              .innerText=${title}
            ></h1>
          </div>

          <div class="instructions-section">
            <h3>Instructions</h3>
            <bb-text-editor-remix
              .value=${editorValue}
              .supportsFastAccess=${true}
              @focus=${this.#onFocus}
              @blur=${this.#onBlur}
              @keydown=${this.#onKeyDown}
            ></bb-text-editor-remix>
          </div>

          <div class="divider"></div>

          <bb-agent-asset-shelf></bb-agent-asset-shelf>

          <div class="divider"></div>

          <bb-tool-shelf></bb-tool-shelf>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-agent-config-column": AgentConfigColumn;
  }
}
