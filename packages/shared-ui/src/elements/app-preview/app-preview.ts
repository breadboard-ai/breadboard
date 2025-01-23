/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");
const GlobalStrings = StringsHelper.forSection("Global");

import { HTMLTemplateResult, LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BoardServer,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  isLLMContent,
  isLLMContentArray,
} from "@google-labs/breadboard";

import { styles as appPreviewStyles } from "./app-preview.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { UserInput } from "../elements.js";
import { SettingsStore } from "../../data/settings-store.js";
import { classMap } from "lit/directives/class-map.js";
import { InputEnterEvent, RunEvent, StopEvent } from "../../events/events.js";
import { until } from "lit/directives/until.js";
import { DirectiveResult } from "lit/directive.js";
import { cache, CacheDirective } from "lit/directives/cache.js";
import { UserInputConfiguration } from "../../types/types.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/behaviors.js";

@customElement("bb-app-preview")
export class AppPreview extends LitElement {
  @property({ reflect: false })
  graph: GraphDescriptor | null = null;

  @property({ reflect: false })
  run: InspectableRun | null = null;

  @property({ reflect: false })
  inputsFromLastRun: InspectableRunInputs | null = null;

  @property({ reflect: false })
  events: InspectableRunEvent[] | null = null;

  @property()
  boardServers: BoardServer[] = [];

  @property({ reflect: true })
  eventPosition = 0;

  @property()
  settings: SettingsStore | null = null;

  @property({ reflect: true })
  showHistory = false;

  static styles = appPreviewStyles;

  #seenItems = new Set<string>();
  #newestEntry: Ref<HTMLElement> = createRef();
  #userInputRef: Ref<UserInput> = createRef();

  protected updated(): void {
    if (!this.#newestEntry.value) {
      return;
    }

    this.#newestEntry.value.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  async #renderPendingInput(event: InspectableRunNodeEvent | null) {
    let preamble: HTMLTemplateResult | DirectiveResult<typeof CacheDirective> =
      cache(html`<div class="preamble"></div>`);
    let userInput: HTMLTemplateResult | DirectiveResult<typeof CacheDirective> =
      cache(html`<div class="no-input-needed"></div>`);
    let continueRun: (() => void) | null = null;

    if (event !== null) {
      const { inputs, node } = event;
      const nodeSchema = await node.describe(inputs);
      const descriptor = node.descriptor;
      const schema = nodeSchema?.outputSchema || inputs.schema;
      const requiredFields = schema.required ?? [];

      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        this.dispatchEvent(
          new InputEnterEvent(descriptor.id, {}, /* allowSavingIfSecret */ true)
        );
      }

      // TODO: Implement support for multiple iterations over the
      // same input over a run. Currently, we will only grab the
      // first value.
      const values = this.inputsFromLastRun?.get(descriptor.id)?.[0];
      const userInputs: UserInputConfiguration[] = Object.entries(
        schema.properties ?? {}
      ).reduce((prev, [name, schema]) => {
        let value = values ? values[name] : undefined;
        if (schema.type === "object") {
          if (isLLMContentBehavior(schema)) {
            if (!isLLMContent(value)) {
              value = undefined;
            }
          } else {
            value = JSON.stringify(value, null, 2);
          }
        }

        if (schema.type === "array") {
          if (isLLMContentArrayBehavior(schema)) {
            if (!isLLMContentArray(value)) {
              value = undefined;
            }
          } else {
            value = JSON.stringify(value, null, 2);
          }
        }

        if (schema.type === "string" && typeof value === "object") {
          value = undefined;
        }

        prev.push({
          name,
          title: schema.title ?? name,
          secret: false,
          schema,
          configured: false,
          required: requiredFields.includes(name),
          value,
        });

        return prev;
      }, [] as UserInputConfiguration[]);

      continueRun = () => {
        if (!this.#userInputRef.value) {
          return;
        }

        const outputs = this.#userInputRef.value.processData(true);
        if (!outputs) {
          return;
        }

        this.dispatchEvent(
          new InputEnterEvent(
            descriptor.id,
            outputs,
            /* allowSavingIfSecret */ true
          )
        );
      };

      const userMessage = userInputs.map((input) => {
        return html`<span>${input.title}</span>`;
      });

      preamble = html`<div class="preamble">
        ${node.description() && node.title() !== node.description()
          ? html`<h2>${node.description()}</h2>`
          : html`<h2>${userMessage}</h2>`}
      </div>`;

      userInput = html`<bb-user-input
        .boardServers=${this.boardServers}
        .showTypes=${false}
        .showTitleInfo=${false}
        .inputs=${userInputs}
        .inlineControls=${true}
        .llmInputShowEntrySelector=${false}
        .useChatInput=${true}
        ${ref(this.#userInputRef)}
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (!(evt.key === "Enter" && isCtrlCommand)) {
            return;
          }

          if (!continueRun) {
            return;
          }

          continueRun();
        }}
      ></bb-user-input>`;
    }

    return html`${preamble} ${userInput}
      <button
        class="continue-button"
        ?disabled=${continueRun === null}
        @click=${() => {
          if (!continueRun) {
            return;
          }
          continueRun();
        }}
      >
        ${Strings.from("COMMAND_CONTINUE")}
      </button>`;
  }

  render() {
    const isRunning = false;
    const newestEvent = this.events?.at(-1);

    return html` <section
      id="content"
      @pointerdown=${() => {
        this.showHistory = false;
      }}
    >
      <header>
        <button
          id="menu"
          @click=${() => {
            this.showHistory = !this.showHistory;
          }}
        >
          Menu
        </button>
        <h1 class="title">
          ${this.graph?.title ?? Strings.from("LABEL_UNTITLED_APP")}
        </h1>
        <div id="controls">
          <button
            id="run"
            title=${GlobalStrings.from("LABEL_RUN_PROJECT")}
            class=${classMap({ running: isRunning })}
            @click=${() => {
              if (isRunning) {
                this.dispatchEvent(new StopEvent());
              } else {
                this.dispatchEvent(new RunEvent());
              }
            }}
          >
            ${isRunning
              ? GlobalStrings.from("LABEL_STOP")
              : GlobalStrings.from("LABEL_RUN")}
          </button>
          <button id="share">Share</button>
          <button id="clear">Clear</button>
        </div>
      </header>
      <div id="history">
        <div id="history-list">
          <h1>History</h1>
          <ul>
            <li>Jan 16, 2.32pm</li>
            <li>Jan 15, 1.32pm</li>
            <li>Jan 14, 5.12pm</li>
            <li>Jan 11, 9.11am</li>
          </ul>
        </div>
      </div>
      <div id="log">
        <bb-chat
          .run=${this.run}
          .events=${this.events}
          .eventPosition=${this.eventPosition}
          .inputsFromLastRun=${this.inputsFromLastRun}
          .showExtendedInfo=${true}
          .settings=${this.settings}
          .showLogTitle=${false}
          .logTitle=${"Run"}
          .boardServers=${this.boardServers}
          .showDebugControls=${false}
        ></bb-chat>
      </div>

      <div id="input">
        ${until(
          this.#renderPendingInput(
            newestEvent?.type === "node" &&
              newestEvent.node.descriptor.type === "input"
              ? newestEvent
              : null
          )
        )}
      </div>
      <footer>
        ${Strings.from("LABEL_FOOTER")} ${GlobalStrings.from("APP_NAME")}
      </footer>
    </section>`;
  }
}
