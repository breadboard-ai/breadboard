/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import { isCtrlCommand } from "../../../input/is-ctrl-command.js";
import * as Styles from "../../../styles/styles.js";
import {
  extractPromptText,
  parsePrompt,
  promptToBlocks,
} from "../../../../utils/prompt-utils.js";

@customElement("bb-objective-editor")
export class ObjectiveEditor extends SignalWatcher(LitElement) {
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
        width: 100%;
        flex: 1;
        min-height: 0;
        background: light-dark(var(--n-100), var(--n-0));
      }

      .objective-editor-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        border-radius: var(--bb-grid-size-3);
        border: 1px solid light-dark(var(--n-90), var(--n-30));
        background: light-dark(var(--n-100), var(--n-10));
        overflow: hidden;
        transition:
          box-shadow 0.2s cubic-bezier(0, 0, 0.3, 1),
          border-color 0.2s cubic-bezier(0, 0, 0.3, 1);
      }

      .objective-editor-wrapper:focus-within {
        border-color: var(--light-dark-n-40);
        box-shadow: var(--bb-elevation-3);
      }

      .section-header {
        display: flex;
        align-items: center;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        border-bottom: 1px solid light-dark(var(--n-95), var(--n-20));
        background: light-dark(var(--n-98), var(--n-15));

        & h2 {
          margin: 0;
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: light-dark(var(--n-20), var(--n-80));
        }

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
          font-size: 20px;
          color: var(--light-dark-n-40);
        }
      }

      /* Styles for the text editor container to size it nicely */
      .editor-container {
        flex: 1;
        min-height: 120px;
        position: relative;
      }

      bb-text-editor-remix,
      bb-text-editor {
        --text-editor-height: 100%;
        --text-editor-padding-top: var(--bb-grid-size-3);
        --text-editor-padding-right: var(--bb-grid-size-4);
        --text-editor-padding-bottom: var(--bb-grid-size-3);
        --text-editor-padding-left: var(--bb-grid-size-4);
        height: 100%;
        border: none;
        background: transparent;
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

  render() {
    const graphController = this.sca?.controller?.editor?.graph;
    if (!graphController) return nothing;

    // Re-render when graph changes to ensure the correct prompt is rendered.
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

    console.log("render");
    return html`
      <div class="objective-editor-wrapper">
        <div class="section-header">
          <span class="g-icon filled round">psychology</span>
          <h2>Objective</h2>
        </div>
        <div class="editor-container">
          <bb-text-editor-remix
            .value=${editorValue}
            .supportsFastAccess=${true}
            @focus=${this.#onFocus}
            @blur=${this.#onBlur}
            @keydown=${this.#onKeyDown}
          ></bb-text-editor-remix>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-objective-editor": ObjectiveEditor;
  }
}
