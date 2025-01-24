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
  isImageURL,
  isLLMContent,
  isLLMContentArray,
  isTextCapabilityPart,
} from "@google-labs/breadboard";

import { until } from "lit/directives/until.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { repeat } from "lit/directives/repeat.js";
import { styles as appPreviewStyles } from "./chat.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { UserInput } from "../elements.js";
import { markdown } from "../../directives/markdown.js";
import { SettingsStore } from "../../data/settings-store.js";
import { formatError } from "../../utils/format-error.js";
import { ChatState } from "../../state/types.js";

@customElement("bb-chat")
export class Chat extends LitElement {
  @property({ reflect: false })
  graph: GraphDescriptor | null = null;

  /**
   * Provides an up-to-date model of the chat state.
   * See `ChatController` for the implementation that manages the model.
   */
  @property()
  state: ChatState | null = null;

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
      block: "end",
      inline: "end",
    });
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
      ${node.title() !== node.type().type()
        ? html`<h1 class="">${node.title()}</h1>`
        : nothing}
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
              ? html`<bb-llm-output
                  .clamped=${false}
                  .showModeToggle=${false}
                  .showEntrySelector=${false}
                  .showExportControls=${true}
                  .value=${nodeValue}
                ></bb-llm-output>`
              : html`No data provided`;
          } else if (isImageURL(nodeValue)) {
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
          <div>
            <div class="value">${value}</div>
          </div>
        </section>`;
      })}
    </section>`;
  }

  render() {
    const newestEvent = this.events?.at(-1);
    return this.events && this.events.length
      ? html`<section id="content">
          <div id="log">
            ${repeat(
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
                      if (
                        type === "input" ||
                        (newestEvent?.type === "node" &&
                          newestEvent.node.descriptor.type === "input")
                      ) {
                        // Inputs are handled by the outer view.
                        content = nothing;
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
                          let context: LLMContent[] = [];
                          if (
                            event.outputs["p-chat"] &&
                            event.outputs.request
                          ) {
                            context = [event.outputs.request] as LLMContent[];
                          } else if (event.outputs.context) {
                            context = event.outputs.context as LLMContent[];
                          }

                          const lastPart = context.at(-1)?.parts.at(-1) ?? null;
                          if (isTextCapabilityPart(lastPart)) {
                            let textContent = lastPart.text;
                            if (textContent.trim() === "") {
                              textContent = "[No input provided]";
                            }

                            content = html`<div class="user-output">
                              <div>
                                <h2 class="title">User Input</h2>
                                <div class="value">
                                  ${markdown(textContent)}
                                </div>
                              </div>
                            </div>`;
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

                    // Secrets handled by the outer view.
                    content = nothing;
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
            )}
          </div>
        </section>`
      : html`<div id="click-run">
          ${Strings.from("LABEL_INITIAL_MESSAGE")}
        </div>`;
  }
}
