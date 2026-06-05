/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { isCtrlCommand } from "../../input/is-ctrl-command.js";
import { StateEvent } from "../../events/events.js";
import * as Styles from "../../styles/styles.js";
import { styleMap } from "lit/directives/style-map.js";
import * as Theme from "../../../theme/index.js";
import {
  extractPromptText,
  parsePrompt,
  promptToBlocks,
} from "../../../utils/prompt-utils.js";

import "../shared/agent-avatar.js";
import "../input/text-editor/text-editor-remix.js";
import "./asset-shelf/asset-shelf.js";
import "./tool-shelf/tool-shelf.js";

@customElement("bb-agent-config-column")
export class AgentConfigColumn extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

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
        height: 100%;
        width: 100%;
        background: var(--light-dark-n-100);
        padding: 80px 120px 80px 160px;
        overflow-y: auto;
        box-sizing: border-box;
      }

      .config-container {
        display: flex;
        flex-direction: column;
        gap: var(--bb-grid-size-10); /* 40px gap */
        max-width: 800px;
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
    `,
  ];

  /**
   * True while the inner text editor has focus. While focused, the text
   * editor owns its internal state — we must not re-set `.value` from the
   * graph or the cursor position and in-progress edits will be clobbered.
   */
  #focused = false;

  #onFocus() {
    this.#focused = true;
  }

  #onBlur(evt: FocusEvent & { target: HTMLInputElement }) {
    this.#focused = false;
    const blocks = promptToBlocks({
      role: "user",
      parts: [{ text: evt.target.value }],
    });
    this.sca.actions.workbench.applyObjective(blocks);
  }

  #onKeyDown(evt: KeyboardEvent & { target: HTMLInputElement }) {
    if (isCtrlCommand(evt) && evt.key === "Enter") {
      evt.preventDefault();
      const blocks = promptToBlocks({
        role: "user",
        parts: [{ text: evt.target.value }],
      });
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-agent-config-column": AgentConfigColumn;
  }
}
