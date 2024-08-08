/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  isLLMContent,
  isLLMContentArray,
  type Schema,
} from "@google-labs/breadboard";
import { LitElement, html, css, nothing, type HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { until } from "lit/directives/until.js";
import { type Ref, createRef, ref } from "lit/directives/ref.js";
import {
  type ActivityEvent,
  type UserInputConfiguration,
} from "../../types/types.js";
import { InputEnterEvent } from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import {
  isImageURL,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/types.js";

import * as BreadboardUI from "@breadboard-ai/shared-ui";
import type {
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  RunSecretEvent,
} from "@google-labs/breadboard/harness";

@customElement("bb-activity-log-lite")
export class ActivityLogLite extends LitElement {
  @property()
  events: ActivityEvent[] = [];

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
      grid-template-rows: 32px 24px;
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

    #expand-all {
      background: transparent var(--bb-icon-expand-all-48px) right center / 24px
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

    .entry {
      border: 1px solid var(--bb-neutral-200);
      border-radius: var(--bb-grid-size);
      margin-bottom: var(--bb-grid-size);
      padding: var(--bb-grid-size-3);
    }

    .entry summary::-webkit-details-marker {
      display: none;
    }

    .entry summary {
      display: flex;
      align-items: center;
      list-style: none;
      font: var(--bb-font-title-small);
      color: var(--bb-neutral-700);
    }

    .entry summary::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-ui-300);
      border-radius: 50%;
      margin-right: var(--bb-grid-size-2);
    }

    .entry.input summary::before {
      background: var(--bb-icon-input) center center / 20px 20px no-repeat;
    }

    .entry.output summary::before {
      background: var(--bb-icon-output) center center / 20px 20px no-repeat;
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
        grid-template-rows: 36px 24px;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-2) var(--bb-grid-size)
          0;
      }

      #activity {
        padding: var(--bb-grid-size-2) var(--bb-grid-size-2)
          var(--bb-grid-size-2) 0;
      }
    }

    @media (min-width: 1120px) {
      #controls {
        grid-template-rows: 40px 24px;
        padding: var(--bb-grid-size-3) 0 0 0;
      }

      #controls input {
        height: 42px;
      }
    }
  `;

  #userInputRef: Ref<BreadboardUI.Elements.UserInput> = createRef();
  #activityRef: Ref<HTMLDivElement> = createRef();

  #getSecretIfAvailable(key: string) {
    return globalThis.localStorage.getItem(key);
  }

  async #renderSecretInput(event: RunSecretEvent) {
    const userInputs: UserInputConfiguration[] = event.data.keys.reduce(
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

  async #renderPendingInput(event: RunNodeStartEvent) {
    const schema = event.data.inputs.schema as Schema;
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
          event.data.node.id,
          outputs,
          /* allowSavingIfSecret */ true
        )
      );
    };

    return html`<bb-user-input
        id="${event.data.node.id}"
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
      </button>`;
  }

  async #renderCompletedInputOrOutput(event: RunNodeEndEvent | RunOutputEvent) {
    const { node, outputs } = event.data;
    const schema = node.configuration?.schema as Schema;
    const properties = schema.properties ?? {};

    console.log(event);

    return html`<dl class="node-output">
      ${Object.entries(outputs).map(([name, nodeValue]) => {
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
          } else if (isImageURL(nodeValue)) {
            value = html`<img src=${nodeValue.image_url} />`;
          } else {
            value = html`<bb-json-tree .json=${nodeValue}></bb-json-tree>`;
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
              [node.type]: true,
            })}
          >${renderableValue}</div>`;
        }

        return html`${value}`;
      })}
    </dl>`;
  }

  #renderEvents(events: ActivityEvent[]) {
    return html`${map(events, (event, idx) => {
      let title: HTMLTemplateResult | symbol = nothing;
      let description: HTMLTemplateResult | symbol = nothing;
      let content: HTMLTemplateResult | Promise<HTMLTemplateResult> | symbol =
        nothing;
      const classes: Record<string, boolean> = {
        entry: true,
      };

      switch (event.type) {
        case "nodestart": {
          const nodeEvent = event as RunNodeEndEvent;
          if (idx < events.length - 1) {
            return nothing;
          }

          if (nodeEvent.data.node.type === "input") {
            title = html`Input`;
            content = this.#renderPendingInput(event as RunNodeStartEvent);
            classes.input = true;
          } else {
            title = html`Working...`;
          }
          break;
        }

        case "nodeend": {
          const nodeEvent = event as RunNodeEndEvent;
          if (
            nodeEvent.data.node.type !== "input" ||
            nodeEvent.data.path.length > 1
          ) {
            return nothing;
          }

          title = html`Input`;
          content = this.#renderCompletedInputOrOutput(
            event as RunNodeEndEvent
          );
          classes.input = true;
          break;
        }

        case "secret": {
          // Only render when they are the most recent event.
          if (idx < events.length - 1) {
            return nothing;
          }

          title = html`Secret`;
          content = this.#renderSecretInput(event as RunSecretEvent);
          classes.secret = true;
          break;
        }

        case "output": {
          title = html`Output`;
          content = this.#renderCompletedInputOrOutput(event as RunOutputEvent);
          classes.output = true;
          break;
        }

        default: {
          console.log(event);
          return nothing;
        }
      }

      return html`<section class=${classMap(classes)}>
        <details ?open=${
          idx === events.length - 1 || event.type === "output"
        }><summary>${title}</summary></h1>
        <div>
        ${description}
        ${until(content)}
      </div>
        </details>
      </section>`;
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
    const randomMessage = [
      {
        srcset: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f648/512.webp",
        src: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f648/512.gif",
        alt: "🙈",
      },
      {
        srcset:
          "https://fonts.gstatic.com/s/e/notoemoji/latest/1f636_200d_1f32b_fe0f/512.webp",
        src: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f636_200d_1f32b_fe0f/512.gif",
        alt: "😶",
      },
    ];

    const message =
      randomMessage[Math.floor(Math.random() * randomMessage.length)];

    return html` <div id="controls">
        <input type="search" placeholder="Search Activity" />
        <div id="actions">
          ${this.events.length
            ? html`<button
                  @click=${() => this.#jumpToBottom()}
                  id="jump-to-bottom"
                >
                  Jump to bottom</button
                ><button @click=${() => this.#expandAll()} id="expand-all">
                  Expand all
                </button>`
            : nothing}
        </div>
      </div>
      <div id="activity" ${ref(this.#activityRef)}>
        ${this.events.length
          ? this.#renderEvents(this.events)
          : html`<div id="no-events">
              <picture>
                <source srcset="${message!.srcset}" type="image/webp" />
                <img
                  src="${message!.src}"
                  alt="${message!.alt}"
                  width="128"
                  height="128"
                />
              </picture>
              <p>No activity information</p>
            </div>`}
      </div>`;
  }
}
