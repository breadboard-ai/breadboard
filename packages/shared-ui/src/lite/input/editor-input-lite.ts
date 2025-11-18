/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../../strings/helper.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GraphDescriptor, GraphTheme } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { StateEvent } from "../../events/events.js";
import "../../elements/input/expanding-textarea.js";
import {
  type FlowGenerator,
  flowGeneratorContext,
} from "../../flow-gen/flow-generator.js";
import { classMap } from "lit/directives/class-map.js";
import { ActionTracker } from "../../utils/action-tracker.js";
import { projectStateContext } from "../../contexts/project-state.js";
import { Project } from "../../state/types.js";
import { err, ok } from "@breadboard-ai/utils";
import { SignalWatcher } from "@lit-labs/signals";
import * as Styles from "../../styles/styles";

const Strings = StringsHelper.forSection("Editor");

type State =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown };

@customElement("bb-editor-input-lite")
export class EditorInputLite extends SignalWatcher(LitElement) {
  static styles = [
    Styles.HostIcons.icons,
    Styles.HostBehavior.behavior,
    Styles.HostColors.baseColors,
    Styles.HostType.type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        border-radius: var(--bb-grid-size-6);
      }

      #container {
        display: flex;
        flex-direction: column;

        & bb-expanding-textarea {
          --min-lines: 1;
          --max-lines: 4;
          --padding: var(--bb-grid-size-3);
          --border-color: var(--light-dark-n-90);
          --border-radius: var(--bb-grid-size-6);

          &:focus-within {
            outline: 1px solid var(--light-dark-p-70);
          }
        }
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  @consume({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator | undefined;

  @consume({ context: projectStateContext })
  accessor projectState: Project | undefined;

  @property({ type: Object })
  accessor currentGraph: GraphDescriptor | undefined;

  @state()
  accessor #state: State = { status: "initial" };

  @property({ type: Boolean, reflect: true })
  accessor focused = false;

  @property({ type: Boolean, reflect: true })
  accessor generating = false;

  @property({ type: Boolean, reflect: true })
  accessor hasEmptyGraph = false;

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  readonly #descriptionInput = createRef<HTMLTextAreaElement>();

  override render() {
    const isGenerating = this.#state.status === "generating";
    const iconClasses = {
      "g-icon": true,
      "filled-heavy": true,
      round: true,
      rotate: isGenerating,
    };
    return html`
      <div id="container">
        <bb-expanding-textarea
          ${ref(this.#descriptionInput)}
          .disabled=${isGenerating}
          .classes=${"sans-flex w-400 md-body-large"}
          .orientation=${"vertical"}
          .placeholder=${this.hasEmptyGraph
            ? Strings.from("COMMAND_DESCRIBE_FRESH_FLOW")
            : Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
          @change=${this.#onInputChange}
          @focus=${this.#onInputFocus}
          @blur=${this.#onInputBlur}
          ><span class=${classMap(iconClasses)} slot="submit"
            >${isGenerating ? "progress_activity" : "send"}</span
          ></bb-expanding-textarea
        >
      </div>
    `;
  }

  override async updated(changes: PropertyValues) {
    if (changes.has("#state") && this.#state.status === "error") {
      this.#descriptionInput.value?.focus();
      this.highlighted = true;
      setTimeout(() => (this.highlighted = false), 2500);
    }
  }

  #onInputChange() {
    const input = this.#descriptionInput.value;
    if (!input) {
      return;
    }

    const description = input?.value;
    if (description) {
      if (description === "/force generating") {
        this.#state = { status: "generating" };
        return;
      } else if (description === "/force initial") {
        this.#state = { status: "initial" };
        return;
      }
      this.#state = { status: "generating" };

      ActionTracker.flowGenEdit(this.currentGraph?.url);

      this.dispatchEvent(new StateEvent({ eventType: "host.lock" }));

      const generating = this.#generateBoard(description);

      const newGraph = (this.currentGraph?.nodes.length || 0) === 0;
      const creatingTheme = newGraph
        ? this.projectState?.themes.generateThemeFromIntent(description)
        : Promise.resolve(err(`Existing graph, skipping theme generation`));

      Promise.allSettled([generating, creatingTheme])
        .then(([generated, createdTheme]) => {
          if (generated.status === "rejected") {
            return this.#onGenerateError(generated.reason);
          }
          let theme;
          if (createdTheme.status === "fulfilled" && ok(createdTheme.value)) {
            theme = createdTheme.value;
          }
          return this.#onGenerateComplete(generated.value, theme);
        })
        .finally(() => {
          this.dispatchEvent(new StateEvent({ eventType: "host.unlock" }));
        });
    }
  }

  #onClearError() {
    this.#state = { status: "initial" };
  }

  async #generateBoard(intent: string): Promise<GraphDescriptor> {
    if (!this.flowGenerator) {
      throw new Error(`No FlowGenerator was provided`);
    }
    this.generating = true;
    const { flow } = await this.flowGenerator.oneShot({
      intent,
      context: { flow: this.currentGraph },
    });
    return flow;
  }

  #onGenerateComplete(graph: GraphDescriptor, theme?: GraphTheme) {
    if (this.#state.status !== "generating") {
      return;
    }
    this.dispatchEvent(
      new StateEvent({
        eventType: "board.replace",
        replacement: graph,
        theme,
        creator: { role: "assistant" },
      })
    );
    this.#state = { status: "initial" };
    this.#clearInput();
    this.generating = false;
  }

  #onGenerateError(error: unknown) {
    if (this.#state.status !== "generating") {
      return;
    }
    console.error("Error generating board", error);
    this.#state = { status: "error", error };
    this.generating = false;
  }

  #clearInput() {
    if (this.#descriptionInput.value) {
      this.#descriptionInput.value.value = "";
    }
  }

  #onInputFocus() {
    this.focused = true;
  }

  #onInputBlur() {
    this.focused = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-editor-input-lite": EditorInputLite;
  }
}
