/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphProvider,
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
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { InputEnterEvent, InputRequestedEvent } from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../directives/markdown.js";
import { SETTINGS_TYPE, UserInputConfiguration } from "../../types/types.js";
import { styles as activityLogStyles } from "./activity-log.styles.js";
import { SettingsStore } from "../../types/types.js";
import { UserInput } from "../elements.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/index.js";
import { formatError } from "../../utils/format-error.js";

@customElement("bb-activity-log")
export class ActivityLog extends LitElement {
  @property({ reflect: false })
  run: InspectableRun | null = null;

  @property({ reflect: false })
  inputsFromLastRun: InspectableRunInputs | null = null;

  @property({ reflect: false })
  events: InspectableRunEvent[] | null = null;

  @property({ reflect: true })
  eventPosition = 0;

  @property({ reflect: true })
  logTitle = "Activity Log";

  @property()
  waitingMessage = 'Click "Run Board" to get started';

  @property({ reflect: true })
  showExtendedInfo = false;

  @property({ reflect: true })
  showLogTitle = true;

  @property()
  settings: SettingsStore | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  #seenItems = new Set<string>();
  #newestEntry: Ref<HTMLElement> = createRef();
  #userInputRef: Ref<UserInput> = createRef();
  #isHidden = false;
  #serializedRun: SerializedRun | null = null;
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

  static styles = activityLogStyles;

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

  #createRunInfo(runs: InspectableRun[] = []): HTMLTemplateResult | symbol {
    if (runs.length === 0) {
      return nothing;
    }

    return html`${map(runs, (run) => {
      if (run.events.length === 0) {
        return nothing;
      }

      return html`<details class="subgraph-info">
        <summary>
          <span class="activity-summary"
            >${run.events.map((event, idx) => {
              if (event.type !== "node") {
                return nothing;
              }

              const classes: Record<string, boolean> = {
                "neural-activity": true,
                pending: idx === run.events.length - 1 && run.end === null,
                [event.node.descriptor.type]: true,
              };

              return html`<div class=${classMap(classes)}></div>`;
            })}</span
          >
        </summary>
        ${map(run.events, (event, idx) => {
          if (event.type !== "node") {
            return nothing;
          }

          const { type } = event.node.descriptor;

          const classes: Record<string, boolean> = {
            "activity-entry": true,
            pending: idx === run.events.length - 1 && run.end === null,
            [type]: true,
          };

          return html`<div class=${classMap(classes)}>
            <div class="content">
              <h1 data-message-id=${this.showExtendedInfo ? event.id : nothing}>
                ${event.node.description()}
              </h1>
              ${this.#createRunInfo(event.runs)}
            </div>
          </div>`;
        })}
      </details>`;
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

  #download(evt: Event) {
    if (!(evt.target instanceof HTMLAnchorElement)) {
      return;
    }

    if (!this.#serializedRun) {
      return;
    }

    const data = JSON.stringify(this.#serializedRun, null, 2);

    evt.target.download = `run-${new Date().toISOString()}.json`;
    evt.target.href = URL.createObjectURL(
      new Blob([data], { type: "application/json" })
    );
    this.#serializedRun = null;
    this.requestUpdate();
  }

  async #getRunLog(evt: Event) {
    if (!(evt.target instanceof HTMLAnchorElement)) {
      return;
    }

    if (!this.run || !this.run.serialize) {
      return;
    }

    if (evt.target.href) {
      URL.revokeObjectURL(evt.target.href);
    }

    evt.target.textContent = "Creating Download...";

    this.#serializedRun = await this.run.serialize();
    this.requestUpdate();
  }

  async #renderSecretInput(idx: number, event: InspectableRunSecretEvent) {
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

    return html`<section class=${classMap({ "user-required": this.#isHidden })}>
      <h1 data-message-idx=${idx}>${event.type}</h1>
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

      <button class="continue-button" @click=${() => continueRun()}>
        Continue
      </button>
    </section>`;
  }

  async #renderPendingInput(idx: number, event: InspectableRunNodeEvent) {
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

    return html`<section class=${classMap({ "user-required": this.#isHidden })}>
      <h1 ?data-message-idx=${this.showExtendedInfo ? idx : nothing}>
        ${node.title()}
      </h1>
      <bb-user-input
        id="${descriptor.id}"
        .providers=${this.providers}
        .providerOps=${this.providerOps}
        .showTypes=${false}
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
      <button class="continue-button" @click=${() => continueRun()}>
        Continue
      </button>
    </section>`;
  }

  async #renderDoneInputOrOutput(event: InspectableRunNodeEvent) {
    const { node, inputs, outputs } = event;
    const allPorts = await node.ports(inputs, outputs as OutputValues);
    const type = node.descriptor.type;
    const isOutput = type === "output";
    const portList = isOutput ? allPorts.inputs : allPorts.outputs;

    return html`<dl class="node-output">
      ${portList.ports.map((port) => {
        if (port.star) return nothing;
        if (isOutput && port.name === "schema") return nothing;
        const nodeValue = port.value;
        let value: HTMLTemplateResult | symbol = nothing;
        if (typeof nodeValue === "object") {
          if (isLLMContentArray(nodeValue)) {
            value = html`<bb-llm-output-array
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
              : "No value provided"}`;
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

        return html`<dd>${port.title}</dd>
          <dt>${value}</dt>`;
      })}
    </dl>`;
  }

  render() {
    if (!this.events || this.#seenItems.size > this.events.length) {
      this.#seenItems.clear();
    }
    const showLogDownload = this.run && this.run.serialize;

    const downloadReady = !!this.#serializedRun;

    return html`
      ${this.showLogTitle
        ? html`<h1>
            <span>${this.logTitle}</span>${showLogDownload
              ? downloadReady
                ? html`<a @click=${(evt: Event) => this.#download(evt)}
                    >Click to Download</a
                  >`
                : html`<a @click=${(evt: Event) => this.#getRunLog(evt)}
                    >Download</a
                  >`
              : nothing}
          </h1>`
        : html`${showLogDownload
            ? downloadReady
              ? html`<aside id="download-container">
                  <a
                    class="download"
                    @click=${(evt: Event) => this.#download(evt)}
                    >Click to Download</a
                  >
                </aside>`
              : html`<aside id="download-container">
                  <a
                    class="download"
                    @click=${(evt: Event) => this.#getRunLog(evt)}
                    >Download</a
                  >
                </aside>`
            : nothing}`}
      ${this.events && this.events.length
        ? this.events.map((event, idx) => {
            const isNew = this.#seenItems.has(event.id);
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
                    content = html`<h1>Working</h1>`;
                  } else {
                    content = html`
                      <h1>
                        ${node.title()} ${this.#getNewestSubtask(event.runs)}
                      </h1>
                      ${this.#createRunInfo(event.runs)}
                    `;
                  }
                } else {
                  let additionalData: Promise<HTMLTemplateResult> | symbol =
                    nothing;
                  if (type === "input" || type === "output") {
                    additionalData = this.#renderDoneInputOrOutput(event);
                  }

                  content = html`<section>
                    <h1
                      data-message-id=${this.showExtendedInfo
                        ? event.id
                        : nothing}
                    >
                      ${node.title()}
                    </h1>
                    ${until(additionalData)} ${this.#createRunInfo(event.runs)}
                  </section>`;
                  break;
                }
                break;
              }

              case "secret": {
                if (event.end !== null) {
                  return nothing;
                }

                content = this.#renderSecretInput(idx, event);
                break;
              }

              case "error": {
                const output = formatError(event.error);
                content = html`${output}`;
                break;
              }

              default: {
                return nothing;
              }
            }

            const classes: Record<string, boolean> = {
              "activity-entry": true,
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
              const visual = event.node.descriptor.metadata.visual as Record<
                string,
                string
              >;
              if (visual.icon) {
                classes.icon = true;
                styles["--node-icon"] = `url(${visual.icon})`;
              }
            }

            return html`<div
              ${ref(this.#newestEntry)}
              style="${styleMap(styles)}"
              class="${classMap(classes)}"
            >
              <div class="content">${until(content)}</div>
            </div>`;
          })
        : html`<div id="click-run">${this.waitingMessage}</div>`}
    `;
  }
}
