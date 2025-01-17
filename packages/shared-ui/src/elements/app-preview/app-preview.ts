/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  LLMContent,
  OutputValues,
} from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");
const GlobalStrings = StringsHelper.forSection("Global");

import { LitElement, html, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BoardServer,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
  Schema,
} from "@google-labs/breadboard";

import { SETTINGS_TYPE, UserInputConfiguration } from "../../types/types.js";
import { until } from "lit/directives/until.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { repeat } from "lit/directives/repeat.js";
import { styles as appPreviewStyles } from "./app-preview.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { UserInput } from "../elements.js";
import { markdown } from "../../directives/markdown.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/behaviors.js";
import { InputEnterEvent } from "../../events/events.js";
import { SettingsStore } from "../../data/settings-store.js";
import { formatError } from "../../utils/format-error.js";

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

  async #renderPendingInput(event?: InspectableRunEvent) {
    if (
      event &&
      event.type === "node" &&
      event.node.descriptor.type === "input"
    ) {
      const { inputs, node } = event;
      const nodeSchema = await node.describe(inputs);
      const descriptor = node.descriptor;
      const schema = nodeSchema?.outputSchema || inputs.schema;
      const requiredFields = (inputs.schema as Schema).required ?? [];

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

      const continueRun = () => {
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

      return html`
        <div class="user-input">
          <div class="icon"></div>
          <div class="input">
            <h2 class="title">${event.node.title()}</h2>
            <bb-user-input
              id="${descriptor.id}"
              .boardServers=${this.boardServers}
              .showTypes=${false}
              .showTitleInfo=${false}
              .llmInputShowEntrySelector=${false}
              .inputs=${userInputs}
              .inlineControls=${true}
              ${ref(this.#userInputRef)}
              @keydown=${(evt: KeyboardEvent) => {
                const isMac = navigator.platform.indexOf("Mac") === 0;
                const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

                if (!(evt.key === "Enter" && isCtrlCommand)) {
                  return;
                }

                continueRun();
              }}
            ></bb-user-input>
            <div id="continue-button-container">
              <button class="continue-button" @click=${() => continueRun()}>
                Continue
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return html`<div id="container">No input required</div>
      <div id="continue-button-container">
        <button disabled class="continue-button">Continue</button>
      </div>`;
  }

  #isImageURL(nodeValue: unknown): nodeValue is { image_url: string } {
    if (typeof nodeValue !== "object" || !nodeValue) {
      return false;
    }

    return "image_url" in nodeValue;
  }

  async #renderNodeOutputs(event: InspectableRunNodeEvent) {
    const { node, inputs, outputs } = event;
    const allPorts = await node.ports(inputs, outputs as OutputValues);
    const type = node.descriptor.type;
    const isOutput = type === "output";
    const portList = (
      isOutput ? allPorts.inputs : allPorts.outputs
    ).ports.filter((port) => {
      if (port.star) return false;
      if (isOutput && port.name === "schema") return false;
      if (port.name === "$error") return false;
      return true;
    });

    return html`<section class="output">
      ${portList.map((port) => {
        const nodeValue = port.value;
        let value: HTMLTemplateResult | symbol = nothing;
        if (typeof nodeValue === "object") {
          if (isLLMContentArray(nodeValue)) {
            value = html`<bb-llm-output-array
              .clamped=${false}
              .showModeToggle=${false}
              .showEntrySelector=${false}
              .showExportControls=${true}
              .values=${nodeValue}
            ></bb-llm-output-array>`;
          } else if (isLLMContent(nodeValue)) {
            if (!nodeValue.parts) {
              // Special case for "$metadata" item.
              // See https://github.com/breadboard-ai/breadboard/issues/1673
              // TODO: Make this not ugly.
              const data = (nodeValue as unknown as { data: unknown }).data;
              value = html`<bb-json-tree .json=${data}></bb-json-tree>`;
            }

            if (!nodeValue.parts.length) {
              value = html`No data provided`;
            }

            value = nodeValue.parts.length
              ? html`<bb-llm-output .value=${nodeValue}></bb-llm-output>`
              : html`No data provided`;
          } else if (this.#isImageURL(nodeValue)) {
            value = html`<img src=${nodeValue.image_url} />`;
          } else {
            value = html`<bb-json-tree .json=${nodeValue}></bb-json-tree>`;
          }
        } else {
          let renderableValue: HTMLTemplateResult | symbol = nothing;
          if (
            port.schema.format === "markdown" &&
            typeof nodeValue === "string"
          ) {
            renderableValue = html`${markdown(nodeValue)}`;
          } else {
            renderableValue = html`${nodeValue !== undefined
              ? nodeValue
              : html`<span class="no-value">[No value provided]</span>`}`;
          }

          // prettier-ignore
          value = html`<div
              class=${classMap({
                markdown: port.schema.format === 'markdown',
                [type]: true,
              })}
            >${renderableValue}</div>`;
        }

        return html` <section class="model-output">
          <div class="icon"></div>
          <div>
            <h2 class="title">${port.title}</h2>
            <div class="value">${value}</div>
          </div>
        </section>`;
      })}
    </section>`;
  }

  async #renderSecretInput(event: InspectableRunSecretEvent) {
    const userInputs: UserInputConfiguration[] = event.keys.reduce(
      (prev, key) => {
        const schema: Schema = {
          properties: {
            secret: {
              title: key,
              description: `Enter ${key}`,
              type: "string",
            },
          },
        };

        const savedSecret =
          this.settings?.getSection(SETTINGS_TYPE.SECRETS).items.get(key) ??
          null;

        let value = undefined;
        if (savedSecret) {
          value = savedSecret.value;
        }

        prev.push({
          name: key,
          title: schema.title ?? key,
          secret: true,
          schema,
          configured: false,
          required: true,
          value,
        });

        return prev;
      },
      [] as UserInputConfiguration[]
    );

    // If there aren't any secrets to enter, we can skip rendering the control.
    if (userInputs.every((secret) => secret.value !== undefined)) {
      return html``;
    }

    const continueRun = () => {
      if (!this.#userInputRef.value) {
        return;
      }

      const outputs = this.#userInputRef.value.processData(true);
      if (!outputs) {
        return;
      }

      for (const [key, value] of Object.entries(outputs)) {
        if (typeof value !== "string") {
          console.warn(
            `Expected secret as string, instead received ${typeof value}`
          );
          continue;
        }

        // Dispatch an event for each secret received.
        this.dispatchEvent(
          new InputEnterEvent(
            key,
            { secret: value },
            /* allowSavingIfSecret */ true
          )
        );
      }
    };

    return html`<div>
      <div class="edge">
        ${event.keys.map((id) => {
          if (id.startsWith("connection:")) {
            return html`<bb-connection-input
              id=${id}
              .connectionId=${id.replace(/^connection:/, "")}
            ></bb-connection-input>`;
          } else {
            return html`<bb-user-input
              id=${event.id}
              .showTypes=${false}
              .inputs=${userInputs}
              ${ref(this.#userInputRef)}
              @keydown=${(evt: KeyboardEvent) => {
                const isMac = navigator.platform.indexOf("Mac") === 0;
                const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

                if (!(evt.key === "Enter" && isCtrlCommand)) {
                  return;
                }

                continueRun();
              }}
            ></bb-user-input>`;
          }
        })}

        <div class="edge-status"></div>
      </div>

      <button class="continue-button" @click=${() => continueRun()}>
        ${Strings.from("COMMAND_CONTINUE")}
      </button>
    </div>`;
  }

  render() {
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
        ${this.events && this.events.length
          ? html`${repeat(
              this.events,
              (event) => event.id,
              (event) => {
                const isNew = !this.#seenItems.has(event.id);
                this.#seenItems.add(event.id);

                let content:
                  | HTMLTemplateResult
                  | Promise<HTMLTemplateResult>
                  | symbol = nothing;
                switch (event.type) {
                  case "node": {
                    const { node, end } = event;
                    const { type } = node.descriptor;
                    // `end` is null if the node is still running
                    // that is, the `nodeend` for this node hasn't yet
                    // been received.
                    if (end === null) {
                      if (type === "input") {
                        content = this.#renderPendingInput(newestEvent);
                        break;
                      }

                      if (node.descriptor.type === "specialist") {
                        content = html`<h1 class="status">
                          ${GlobalStrings.from("STATUS_GENERIC_WORKING")}
                          ${node.descriptor.metadata?.title
                            ? html`(${node.descriptor.metadata?.title.trim()})`
                            : nothing}
                        </h1>`;
                        break;
                      }

                      content = html`<h1 class="status">
                        ${GlobalStrings.from("STATUS_GENERIC_WORKING")}
                      </h1>`;
                    } else {
                      if (type === "input") {
                        if (event.outputs) {
                          if (event.outputs.context) {
                            const context = event.outputs
                              .context as LLMContent[];
                            const lastPart = context.at(-1)?.parts.at(-1);
                            if (isTextCapabilityPart(lastPart)) {
                              content = html`<div class="user-output">
                                <div class="icon"></div>
                                <div>
                                  <h2 class="title">${event.node.title()}</h2>
                                  <div class="value">
                                    ${markdown(lastPart.text)}
                                  </div>
                                </div>
                              </div>`;
                            }
                          }
                        }

                        break;
                      }

                      if (type !== "output") {
                        return;
                      }
                      const outputs = this.#renderNodeOutputs(event);
                      content = html`
                        <div>
                          ${until(
                            outputs,
                            html`${Strings.from(
                              "STATUS_RETRIEVING_VALUES"
                            )}</span>`
                          )}
                        </div>
                      `;
                      break;
                    }
                    break;
                  }

                  case "secret": {
                    if (event.end !== null) {
                      return nothing;
                    }

                    content = this.#renderSecretInput(event);
                    break;
                  }

                  case "error": {
                    const output = formatError(event.error);
                    content = html`<div class="error-content">${output}</div>`;
                    break;
                  }

                  default: {
                    return nothing;
                  }
                }

                const classes: Record<string, boolean> = {
                  "activity-entry": true,
                  running: event.type === "node" && event.end === null,
                  new: isNew,
                  [event.type]: true,
                };

                if (event.type === "node") {
                  classes[event.node.descriptor.type] = true;
                }

                const styles: Record<string, string> = {};
                if (
                  event.type === "node" &&
                  event.node.descriptor.metadata &&
                  event.node.descriptor.metadata.visual &&
                  typeof event.node.descriptor.metadata.visual === "object"
                ) {
                  const visual = event.node.descriptor.metadata
                    .visual as Record<string, string>;
                  if (visual.icon) {
                    classes.icon = true;
                    styles["--node-icon"] = `url(${visual.icon})`;
                  }
                }

                if (event.type === "node") {
                  return guard(
                    [
                      event.end,
                      event === newestEvent,
                      event.runs.length,
                      event.runs[0]?.events.length ?? 0,
                    ],
                    () =>
                      html`<section
                        ${ref(this.#newestEntry)}
                        style="${styleMap(styles)}"
                        class="${classMap(classes)}"
                      >
                        ${until(content)}
                      </section>`
                  );
                }

                return html`<section
                  ${ref(this.#newestEntry)}
                  style="${styleMap(styles)}"
                  class="${classMap(classes)}"
                >
                  ${until(content)}
                </section>`;
              }
            )}`
          : html`<div id="initial-message">
              ${Strings.from("LABEL_INITIAL_MESSAGE")}
            </div>`}
      </div>
      <footer>
        ${Strings.from("LABEL_FOOTER")} ${GlobalStrings.from("APP_NAME")}
      </footer>
    </section>`;
  }
}
