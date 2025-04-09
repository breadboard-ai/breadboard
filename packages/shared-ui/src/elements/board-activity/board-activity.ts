/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("ActivityLog");
const GlobalStrings = StringsHelper.forSection("Global");

import {
  BoardServer,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  isLLMContent,
  isLLMContentArray,
  OutputValues,
  Schema,
  SerializedRun,
} from "@google-labs/breadboard";
import { LitElement, html, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import {
  InputEnterEvent,
  InputRequestedEvent,
  RunIsolatedNodeEvent,
} from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../directives/markdown.js";
import { SETTINGS_TYPE, UserInputConfiguration } from "../../types/types.js";
import { styles as activityLogStyles } from "./board-activity.styles.js";
import { SettingsStore } from "../../types/types.js";
import { UserInput } from "../elements.js";
import { formatError } from "../../utils/format-error.js";
import { guard } from "lit/directives/guard.js";
import { icons } from "../../styles/icons.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/behaviors.js";

@customElement("bb-board-activity")
export class BoardActivity extends LitElement {
  @property()
  accessor graphUrl: URL | null = null;

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property({ reflect: false })
  accessor inputsFromLastRun: InspectableRunInputs | null = null;

  @property({ reflect: false })
  accessor events: InspectableRunEvent[] | null = null;

  @property({ reflect: true })
  accessor eventPosition = 0;

  @property({ reflect: true })
  accessor logTitle = "Activity Log";

  @property()
  accessor waitingMessage = Strings.from("LABEL_WAITING_MESSAGE");

  @property({ reflect: true })
  accessor showExtendedInfo = false;

  @property({ reflect: true })
  accessor showLogTitle = true;

  @property()
  accessor settings: SettingsStore | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor nextNodeId: string | null = null;

  @state()
  accessor downloadStatus: "initial" | "generating" | "ready" = "initial";

  #seenItems = new Set<string>();
  #newestEntry: Ref<HTMLElement> = createRef();
  #userInputRef: Ref<UserInput> = createRef();
  #isHidden = false;
  #serializedRun: SerializedRun | null = null;
  #serializedRunUrl: string | null = null;

  #observer = new IntersectionObserver((entries) => {
    if (entries.length === 0) {
      return;
    }

    const [entry] = entries;
    if (!entry.rootBounds) {
      return;
    }

    this.#isHidden =
      entry.rootBounds.width === 0 && entry.rootBounds.height === 0;

    if (
      !this.#isHidden &&
      this.#newestEntry.value &&
      this.#newestEntry.value.querySelector(".user-required")
    ) {
      this.#newestEntry.value.scrollIntoView({
        block: "nearest",
        inline: "start",
      });
      this.#newestEntry.value
        .querySelector(".user-required")
        ?.addEventListener("animationend", (evt: Event) => {
          if (!(evt.target instanceof HTMLElement)) {
            return;
          }

          evt.target.classList.remove("user-required");
        });
    }
  });

  static styles = [icons, activityLogStyles];

  #isImageURL(nodeValue: unknown): nodeValue is { image_url: string } {
    if (typeof nodeValue !== "object" || !nodeValue) {
      return false;
    }

    return "image_url" in nodeValue;
  }

  protected updated(): void {
    if (!this.#newestEntry.value) {
      return;
    }

    if (this.#newestEntry.value.querySelector(".user-required")) {
      this.dispatchEvent(new InputRequestedEvent());
    }

    this.#newestEntry.value.scrollIntoView({
      block: "nearest",
      inline: "start",
    });
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#observer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#observer.disconnect();
  }

  #renderComponentActivity(
    runs: InspectableRun[] = []
  ): HTMLTemplateResult | symbol {
    if (runs.length === 0) {
      return nothing;
    }

    return html`${map(runs, (run) => {
      if (run.events.length === 0) {
        return nothing;
      }

      return html`${map(run.events, (event, idx) => {
        if (event.type !== "node") {
          return nothing;
        }

        const { type } = event.node.descriptor;
        const classes: Record<string, boolean> = {
          "activity-entry": true,
          node: true,
          pending: idx === run.events.length - 1 && run.end === null,
          [type]: true,
        };

        const icon = event.node.type().currentMetadata().icon;
        if (icon) {
          classes[icon] = true;
        }

        const hasComponentActivity =
          event.runs.length && event.runs[0].events.length;

        return html`<div class=${classMap(classes)}>
          <div class="content">
            <details class="subgraph-info">
              <summary>
                <span class=${classMap({ expandable: hasComponentActivity })}
                  >${event.node.description()}</span
                >
                ${this.showExtendedInfo
                  ? html`<button
                      class="details m-icon"
                      data-message-id=${event.id}
                    >
                      data_info_alert
                    </button>`
                  : nothing}
              </summary>
              ${this.#renderComponentActivity(event.runs)}
            </details>
          </div>
        </div>`;
      })}`;
    })}`;
  }

  #getNewestSubtask(runs: InspectableRun[] = []): HTMLTemplateResult | symbol {
    if (runs.length === 0) {
      return nothing;
    }

    const newestRun = runs[runs.length - 1];
    const newestEvent = newestRun.events[newestRun.events.length - 1];

    if (!newestEvent || newestEvent.type !== "node") {
      return nothing;
    }

    return html`<span class="newest-task"
      >${newestEvent.node.description()}</span
    >`;
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

    return html`<div class=${classMap({ "user-required": this.#isHidden })}>
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
      </div>

      <button class="continue-button" @click=${() => continueRun()}>
        ${Strings.from("COMMAND_CONTINUE")}
      </button>
    </div>`;
  }

  async #renderPendingInput(idx: number, event: InspectableRunNodeEvent) {
    const { inputs, node } = event;
    const nodeSchema = await node.describe(inputs);
    const descriptor = node.descriptor;
    let schema = nodeSchema?.outputSchema;
    if (!schema || Object.keys(schema).length === 0) {
      schema = inputs.schema as Schema;
    }
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

    return html`<div
      class=${classMap({ pending: true, "user-required": this.#isHidden })}
    >
      <h1 ?data-message-idx=${this.showExtendedInfo ? idx : nothing}>
        ${node.title()}
      </h1>
      <div class="edge">
        ${node.description() && node.title() !== node.description()
          ? html`<h2>${node.description()}</h2>`
          : nothing}
        <bb-user-input
          id="${descriptor.id}"
          .boardServers=${this.boardServers}
          .showTypes=${false}
          .inputs=${userInputs}
          .inlineControls=${true}
          .llmInputShowEntrySelector=${false}
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
      </div>

      <button class="continue-button" @click=${() => continueRun()}>
        ${Strings.from("COMMAND_CONTINUE")}
      </button>
    </div>`;
  }

  async #renderNodeOutputs(
    event: InspectableRunNodeEvent,
    description: string | null,
    stored = false,
    consumed = false
  ) {
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

    const contents = html`${portList.map((port) => {
      const nodeValue = port.value;
      let value: HTMLTemplateResult | symbol = nothing;
      if (typeof nodeValue === "object") {
        if (isLLMContentArray(nodeValue)) {
          value = html`<bb-llm-output-array
            .graphUrl=${this.graphUrl}
            .showModeToggle=${false}
            .showEntrySelector=${false}
            .showExportControls=${type !== "input"}
            .lite=${true}
            .clamped=${false}
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
                .showExportControls=${type !== "input"}
                .graphUrl=${this.graphUrl}
                .lite=${true}
                .clamped=${false}
                .value=${nodeValue}
              ></bb-llm-output>`
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
          value: true,
          [type]: true,
        })}
      >${renderableValue}</div>`;
      }

      return html` <div class="output-port">
        ${type === "input" || !port.schema.title
          ? nothing
          : html`<label>${port.title}</label>`}
        <div class="value">${value}</div>
      </div>`;
    })}`;

    // Special-case inputs.
    if (type === "input") {
      return html`${contents}`;
    }

    // Everything else.
    return html`<div
      class=${classMap({
        "node-output-container": true,
        stored,
        consumed: consumed || isOutput,
      })}
    >
      <details
        ?open=${stored || isOutput || portList.length === 1}
        class="node-output"
      >
        <summary
          class=${classMap({ "with-description": description !== null })}
        >
          ${description ? html`<h2>${description}</h2>` : nothing}
        </summary>
        ${contents}
      </details>
    </div>`;
  }

  render() {
    const newestEvent = this.events?.at(-1);

    const waitingMessage =
      this.events && this.events.length
        ? nothing
        : html`<div id="click-run">${this.waitingMessage}</div>`;

    const events =
      this.events && this.events.length
        ? html`
            ${repeat(
              this.events,
              (event) => event.id,
              (event, idx) => {
                const isNew = !this.#seenItems.has(event.id);
                const isNewestEntry = idx === (this.events?.length ?? 0) - 1;
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
                        content = this.#renderPendingInput(idx, event);
                        break;
                      }

                      if (event.hidden) {
                        content = html`<h1>
                          ${GlobalStrings.from("STATUS_GENERIC_WORKING")}
                        </h1>`;
                      } else {
                        const hasComponentActivity =
                          event.runs.length && event.runs[0].events.length;
                        content = html`
                          <div>
                            <details
                              class=${classMap({
                                "node-info": true,
                              })}
                            >
                              <summary>
                                <span
                                  class=${classMap({
                                    expandable: hasComponentActivity,
                                  })}
                                  >${node.title()}</span
                                >
                              </summary>
                              ${this.#renderComponentActivity(event.runs)}
                            </details>
                            <h2>${this.#getNewestSubtask(event.runs)}</h2>
                          </div>
                        `;
                      }
                    } else {
                      const description =
                        node.description() &&
                        node.description() !== node.title()
                          ? node.description()
                          : null;
                      const outputs = this.#renderNodeOutputs(
                        event,
                        description,
                        false,
                        event !== newestEvent
                      );
                      const hasComponentActivity =
                        event.runs.length && event.runs[0].events.length;
                      content = html`
                        <div class="output-container">
                          ${event.node.type().type() === "input"
                            ? nothing
                            : html`<details class="node-info">
                                <summary>
                                  <span
                                    class=${classMap({
                                      expandable: hasComponentActivity,
                                    })}
                                    >${node.title()}</span
                                  >
                                  <button
                                    class="run-component m-icon filled"
                                    @click=${() => {
                                      this.dispatchEvent(
                                        new RunIsolatedNodeEvent(
                                          event.node.descriptor.id,
                                          true
                                        )
                                      );
                                    }}
                                  >
                                    play_arrow
                                  </button>
                                  ${this.showExtendedInfo
                                    ? html`<button
                                        class="details m-icon"
                                        data-message-id=${event.id}
                                      >
                                        data_info_alert
                                      </button>`
                                    : nothing}
                                </summary>
                                ${this.#renderComponentActivity(event.runs)}
                              </details>`}
                          ${until(
                            outputs,
                            html`<div
                              class=${classMap({
                                "node-output-container": true,
                                stored: false,
                                consumed: true,
                              })}
                            >
                              <details class="node-output">
                                <summary
                                  class=${classMap({
                                    "with-description": description !== null,
                                  })}
                                >
                                  ${description
                                    ? html`<h2>${description}</h2>`
                                    : nothing}
                                  <span class="title"
                                    >${Strings.from(
                                      "STATUS_RETRIEVING_VALUES"
                                    )}</span
                                  >
                                </summary>
                              </details>
                            </div>`
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

                if (
                  event.type === "node" &&
                  event.end !== null &&
                  event.node.type().type() === "input"
                ) {
                  return html`<section
                    ${isNewestEntry ? ref(this.#newestEntry) : nothing}
                    class="user-output"
                  >
                    ${until(content)}
                  </section>`;
                } else {
                  const classes: Record<string, boolean> = {
                    "activity-entry": true,
                    running: event.type === "node" && event.end === null,
                    new: isNew,
                    [event.type]: true,
                  };

                  if (event.type === "node") {
                    classes[event.node.descriptor.type] = true;

                    const icon = event.node.type().currentMetadata().icon;
                    if (icon) {
                      classes[icon] = true;
                    }
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
                      () => {
                        return html`<section
                          ${isNewestEntry ? ref(this.#newestEntry) : nothing}
                          style="${styleMap(styles)}"
                          class="${classMap(classes)}"
                        >
                          ${until(content)}
                        </section>`;
                      }
                    );
                  }

                  return html`<section
                    ${isNewestEntry ? ref(this.#newestEntry) : nothing}
                    style="${styleMap(styles)}"
                    class="${classMap(classes)}"
                  >
                    ${until(content)}
                  </section>`;
                }
              }
            )}
          `
        : nothing;

    return [waitingMessage, events];
  }
}
