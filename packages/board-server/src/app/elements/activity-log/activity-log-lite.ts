/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  isLLMContent,
  isLLMContentArray,
  type ErrorObject,
  type InspectableRun,
  type InspectableRunEvent,
  type InspectableRunNodeEvent,
  type InspectableRunSecretEvent,
  type Schema,
} from "@google-labs/breadboard";
import {
  LitElement,
  html,
  css,
  nothing,
  type HTMLTemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { until } from "lit/directives/until.js";
import { type Ref, createRef, ref } from "lit/directives/ref.js";
import {
  type UserInputConfiguration,
  type UserMessage,
} from "../../types/types.js";
import { InputEnterEvent } from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import {
  isImageURL,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/types.js";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import { repeat } from "lit/directives/repeat.js";
import { guard } from "lit/directives/guard.js";

@customElement("bb-activity-log-lite")
export class ActivityLogLite extends LitElement {
  @property()
  start: number = 0;

  @property()
  message: UserMessage | null = null;

  @property()
  events: InspectableRunEvent[] = [];

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      padding-bottom: 60px;
    }

    #controls {
      position: sticky;
      top: 0;
      background: var(--bb-neutral-0);
      display: grid;
      grid-template-rows: 24px;
      row-gap: var(--bb-grid-size-10);
      align-items: center;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-2);
      z-index: 1;
    }

    #controls input {
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-50);
      width: 100%;
      padding: var(--bb-grid-size-2);
      height: 100%;
    }

    #controls input:placeholder-shown {
      background: var(--bb-neutral-50) var(--bb-icon-search) calc(100% - 5px)
        center / 20px 20px no-repeat;
    }

    #activity {
      padding: var(--bb-grid-size-2);
    }

    #actions {
      display: flex;
      justify-content: flex-end;
    }

    #actions button {
      border: none;
      margin: 0 0 0 var(--bb-grid-size-8);
      padding: 0 var(--bb-grid-size-8) 0 0;
      height: 20px;
      font: var(--bb-font-label-medium);
      color: var(--bb-neutral-600);
      transition: color 0.3s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
    }

    #actions button:focus,
    #actions button:hover {
      color: var(--bb-neutral-800);
      transition-duration: 0.15s;
    }

    #jump-to-bottom {
      background: transparent var(--bb-icon-arrow-down-48px) right center / 24px
        24px no-repeat;
    }

    #actions button:last-of-type {
      margin-right: var(--bb-grid-size);
    }

    #no-events {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--bb-grid-size-10) 0;
      font: var(--bb-font-title-large);
      color: var(--bb-neutral-400);
    }

    .pending-input,
    .edge {
      padding: 24px 8px 24px 64px;
      position: relative;
    }

    .pending-input::before,
    .edge::before {
      content: "";
      position: absolute;
      top: 0;
      left: 40px;
      height: 100%;
      border-left: 1px solid var(--bb-neutral-300);
    }

    .pending-input::after,
    .edge::after {
      content: "";
      position: absolute;
      top: calc(50% - 14px);
      left: 26px;
      width: 28px;
      height: 28px;
      border: 1px solid var(--bb-neutral-300);

      border-radius: 50%;
    }

    .pending-input::after {
      background: var(--bb-neutral-0) var(--bb-icon-input) center center / 20px
        20px no-repeat;
    }

    .edge::after {
      background: var(--bb-neutral-0) var(--bb-icon-output) center center / 20px
        20px no-repeat;
    }

    .edge bb-llm-output,
    .edge bb-llm-output-array {
      margin-bottom: 0;
    }

    .pending-input:last-of-type::before,
    .edge:last-of-type::before {
      height: 50%;
    }

    .entry {
      border: 1px solid var(--bb-neutral-200);
      border-radius: var(--bb-grid-size-10);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      width: 50%;
    }

    .entry.hidden {
      display: none;
    }

    .entry {
      display: flex;
      align-items: flex-start;
      list-style: none;
      font: var(--bb-font-title-small);
      color: var(--bb-neutral-600);
      user-select: none;
    }

    .entry::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-ui-50) var(--bb-icon-generic-node) center center /
        20px 20px no-repeat;
      border-radius: 50%;
      margin-right: var(--bb-grid-size-2);
    }

    .entry.input::before {
      background: var(--bb-icon-input) center center / 20px 20px no-repeat;
    }

    .entry.output::before {
      background: var(--bb-icon-output) center center / 20px 20px no-repeat;
    }

    .entry.secret::before {
      background: var(--bb-icon-password) center center / 20px 20px no-repeat;
    }

    .entry.specialist {
      color: var(--bb-ui-500);
    }

    .entry.specialist::before {
      background: var(--bb-icon-smart-toy) center center / 20px 20px no-repeat;
    }

    .entry.human {
      color: var(--bb-human-500);
    }

    .entry.human::before {
      background: var(--bb-icon-human) center center / 20px 20px no-repeat;
    }

    .entry.looper {
      color: var(--bb-looper-500);
    }

    .entry.looper::before {
      background: var(--bb-icon-lightbulb) center center / 20px 20px no-repeat;
    }

    .entry.joiner {
      color: var(--bb-looper-500);
    }

    .entry.joiner::before {
      background: var(--bb-icon-merge-type) center center / 20px 20px no-repeat;
    }

    .entry.runjavascript {
      color: var(--bb-nodes-700);
    }

    .entry.runjavascript::before {
      background: var(--bb-nodes-400) var(--bb-icon-javascript) center center /
        20px 20px no-repeat;
    }

    .entry .no-information {
      font: var(--bb-font-label-medium);
      color: var(--bb-neutral-600);
      width: 100%;
      text-align: center;
      margin-top: var(--bb-grid-size);
    }

    .continue-button {
      background: var(--bb-ui-100) var(--bb-icon-resume-blue) 8px 4px / 16px
        16px no-repeat;
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    @media (min-width: 700px) {
      #controls {
        grid-template-rows: 24px;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-2)
          var(--bb-grid-size-3) 0;
      }

      #activity {
        padding: var(--bb-grid-size-2) var(--bb-grid-size-2)
          var(--bb-grid-size-2) 0;
      }
    }

    @media (min-width: 1120px) {
      #controls {
        grid-template-rows: 24px;
        padding: var(--bb-grid-size-3) 0;
      }

      #controls input {
        height: 42px;
      }

      #activity {
        padding: var(--bb-grid-size-2) 0;
      }
    }
  `;

  #formatter = new Intl.DateTimeFormat(navigator.languages, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  #userInputRef: Ref<BreadboardUI.Elements.UserInput> = createRef();
  #activityRef: Ref<HTMLDivElement> = createRef();

  #getSecretIfAvailable(key: string) {
    return globalThis.localStorage.getItem(key);
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

        const savedSecret = this.#getSecretIfAvailable(key);

        let value = undefined;
        if (savedSecret) {
          value = savedSecret;
        }

        prev.push({
          name: key,
          title: schema.title ?? key,
          secret: false,
          schema,
          configured: false,
          required: true,
          value,
        });

        return prev;
      },
      [] as UserInputConfiguration[]
    );

    // Potentially do the autosubmit.
    if (userInputs.every((secret) => secret.value !== undefined)) {
      for (const input of userInputs) {
        if (typeof input.value !== "string") {
          console.warn(
            `Expected secret as string, instead received ${typeof input.value}`
          );
          continue;
        }

        // Dispatch an event for each secret received.
        this.dispatchEvent(
          new InputEnterEvent(
            input.name,
            { secret: input.value },
            /* allowSavingIfSecret */ true
          )
        );
      }

      // If we have chosen to autosubmit do not render the control.
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

    return html`<section>
      <bb-user-input
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
      ></bb-user-input>

      <button class="continue-button" @click=${() => continueRun()}>
        Continue
      </button>
    </section>`;
  }

  async #renderPendingInput(event: InspectableRunNodeEvent) {
    const schema = event.inputs.schema as Schema;
    if (!schema) {
      return html`Unable to render`;
    }

    const requiredFields = schema.required ?? [];

    // TODO: Implement support for multiple iterations over the
    // same input over a run. Currently, we will only grab the
    // first value.
    const userInputs: UserInputConfiguration[] = Object.entries(
      schema.properties ?? {}
    ).reduce((prev, [name, schema]) => {
      let value = undefined;
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
          event.node.descriptor.id,
          outputs,
          /* allowSavingIfSecret */ true
        )
      );
    };

    return html`<bb-user-input
        id="${event.node.descriptor.id}"
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
      <button class="continue-button" @click=${() => continueRun()}>
        Continue
      </button>`;
  }

  async #renderCompletedInputOrOutput(event: InspectableRunNodeEvent) {
    const { node, inputs, outputs } = event;
    const items = event.node.descriptor.type === "input" ? outputs : inputs;

    if (!items) {
      return html`Unable to render item`;
    }

    const schema = event.inputs.schema as Schema | undefined;
    const properties = schema?.properties ?? {};

    return html`<dl class="node-output">
      ${Object.entries(items).map(([name, nodeValue]) => {
        let value: HTMLTemplateResult | symbol = nothing;
        if (typeof nodeValue === "object") {
          if (isLLMContentArray(nodeValue)) {
            value = html`<bb-llm-output-array
              .values=${nodeValue}
              .showEntrySelector=${false}
              .showModeToggle=${false}
              .clamped=${false}
              .lite=${true}
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
          } else if (isImageURL(nodeValue)) {
            value = html`<img src=${nodeValue.image_url} />`;
          } else {
            value = nothing;
          }
        } else {
          let renderableValue: HTMLTemplateResult | symbol = nothing;
          const format = properties[name]?.format;
          if (
            format &&
            format === "markdown" &&
            typeof nodeValue === "string"
          ) {
            renderableValue = html`${BreadboardUI.Directives.markdown(
              nodeValue
            )}`;
          } else {
            renderableValue = html`${nodeValue !== undefined
              ? nodeValue
              : "No value provided"}`;
          }

          // prettier-ignore
          value = html`<div
            class=${classMap({
              markdown: format === 'markdown',
              value: true,
              [node.descriptor.type]: true,
            })}
          >${renderableValue}</div>`;
        }

        return html`${value}`;
      })}
    </dl>`;
  }

  #renderEventRunInfo(
    runs: InspectableRun[],
    bubbledInputAndOutputIds: string[]
  ): { found: boolean; tmpl: HTMLTemplateResult } {
    const descender = (
      runs: InspectableRun[],
      bubbled: string,
      target: InspectableRunNodeEvent[]
    ) => {
      for (const run of runs) {
        for (const event of run.events) {
          if (event.type !== "node") {
            continue;
          }

          if (event.id === bubbled) {
            target.push(event);
          } else if (bubbled.startsWith(`${event.id}-`) && event.runs) {
            descender(event.runs, bubbled, target);
          }
        }
      }
    };

    // Populate this events array based on a matching the nested run
    // information with the bubbled events. After that render any events that
    // we've found.
    const events: InspectableRunNodeEvent[] = [];
    for (const bubbled of bubbledInputAndOutputIds) {
      descender(runs, bubbled, events);
    }

    return {
      found: events.length > 0,
      tmpl:
        events.length > 0
          ? html`${map(events, (event) => {
              if (
                event.end === null &&
                event.node.descriptor.type === "input"
              ) {
                return html`${until(this.#renderPendingInput(event))}`;
              }

              return html`${until(this.#renderCompletedInputOrOutput(event))} `;
            })}`
          : html`<div class="no-information">No information available</div>`,
    };
  }

  #renderEvents(events: InspectableRunEvent[]) {
    return html`${map(events, (event) => {
      switch (event.type) {
        case "edge": {
          if (event.to && event.to.length > 1) {
            return nothing;
          }

          // TODO: Only include values that need to be presented to the user
          // i.e., bubbled or tagged as such.
          if (event.value) {
            const schema = event.value.schema as Schema;
            if (schema && schema.properties) {
              const props = Object.entries(schema.properties);
              if (
                props.length === 1 &&
                props[0] &&
                isLLMContentArrayBehavior(props[0][1])
              ) {
                const nodeName = props[0][0];
                const nodeValue = event.value[nodeName];
                if (event.edge.from === "$entry") {
                  return nothing;
                }

                return html`<section class="edge">
                  <bb-llm-output-array
                    .values=${nodeValue}
                    .showEntrySelector=${false}
                    .showModeToggle=${false}
                    .clamped=${false}
                    .lite=${true}
                  ></bb-llm-output-array>
                </section>`;
              }
            }
          }

          return html`<section class="edge empty"></section>`;
        }

        case "node": {
          const { node, end } = event;
          const { type } = node.descriptor;
          const { icon } = node.type().metadata();
          let content:
            | HTMLTemplateResult
            | Promise<HTMLTemplateResult>
            | symbol = nothing;

          const classes: Record<string, boolean> = {
            entry: true,
            pending: end === null,
          };

          classes[type.toLocaleLowerCase()] = true;
          classes.pending = end === null;
          if (icon) {
            classes[icon] = true;
          }

          if (event.hidden || event.node.descriptor.type === "output") {
            return nothing;
          }

          // TODO: It feels like this should be a part of the edge.
          if (end === null) {
            content = html`<section class="pending-input">
              ${until(this.#renderPendingInput(event))}
            </section>`;
          }

          return html` <section class=${classMap(classes)}>
              ${node.title()}
            </section>
            ${content}`;
        }

        case "error": {
          const { error } = event;
          let output = "";
          if (typeof error === "string") {
            output = error;
          } else {
            if ((error.error as Error)?.name === "AbortError") {
              console.log("💖 actually aborted");
            }
            if (typeof error.error === "string") {
              output = error.error;
            } else {
              let messageOutput = "";
              let errorData = error;
              while (typeof errorData === "object") {
                if (errorData && "message" in errorData) {
                  messageOutput += `${errorData.message}\n`;
                }

                errorData = errorData.error as ErrorObject;
              }

              output = messageOutput;
            }
          }

          return html`${output}`;
        }

        case "secret": {
          return html`<section class="secret">
            ${until(this.#renderSecretInput(event))}
          </section>`;
        }
      }
    })}`;
  }

  #expandAll() {
    if (!this.#activityRef.value) {
      return;
    }

    this.#activityRef.value
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach((details) => {
        details.open = true;
      });
  }

  #jumpToBottom() {
    if (!this.#activityRef.value) {
      return;
    }

    const entries =
      this.#activityRef.value.querySelectorAll<HTMLElement>(".entry");
    if (entries.length === 0) {
      return;
    }

    const entry = entries[entries.length - 1];
    if (!entry) {
      return;
    }
    entry.scrollIntoView({ behavior: "smooth" });
  }

  protected updated(): void {
    this.#jumpToBottom();
  }

  render() {
    return html` <div id="controls">
        <div id="actions">
          ${this.events.length
            ? html`<button
                @click=${() => this.#jumpToBottom()}
                id="jump-to-bottom"
              >
                Jump to bottom
              </button>`
            : nothing}
        </div>
      </div>
      <div id="activity" ${ref(this.#activityRef)}>
        ${this.events.length
          ? this.#renderEvents(this.events)
          : html`<div id="no-events">
              <picture>
                <source srcset="${this.message?.srcset}" type="image/webp" />
                <img
                  src="${this.message?.src}"
                  alt="${this.message?.alt}"
                  width="128"
                  height="128"
                />
              </picture>
              <p>No activity information</p>
            </div>`}
      </div>`;
  }
}
