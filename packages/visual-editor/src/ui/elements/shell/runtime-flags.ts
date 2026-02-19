/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { StateEvent } from "../../events/events.js";
import { RuntimeFlags, RUNTIME_FLAG_META } from "@breadboard-ai/types";
import { Task } from "@lit/task";
import { repeat } from "lit/directives/repeat.js";

import * as BreadboardUI from "../../../ui/index.js";
const Strings = BreadboardUI.Strings.forSection("Global");

@customElement("bb-runtime-flags")
export class VERuntimeFlags extends LitElement {
  @property()
  accessor flags: Promise<Readonly<RuntimeFlags>> | null = null;

  static styles = [
    type,
    baseColors,
    css`
      :host {
        display: block;
      }

      p {
        margin: 0 0 var(--bb-grid-size-3) 0;
        color: var(--light-dark-e-20);
      }

      form {
        display: grid;
        align-items: center;
        row-gap: var(--bb-grid-size-3);
        overflow: scroll;
        scrollbar-width: none;
        padding: var(--bb-grid-size-4) 0;
        mask-image: linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0%,
          red var(--bb-grid-size-4),
          red calc(100% - var(--bb-grid-size-4)),
          rgba(0, 0, 0, 0) 100%
        );

        & .entry {
          display: grid;
          grid-template-columns: 1fr 120px;
          align-items: start;

          & .flag-info {
            display: flex;
            flex-direction: column;
            gap: var(--bb-grid-size);
          }

          & .flag-description {
            font-size: var(--bb-body-small);
            color: var(--light-dark-n-20);
          }

          & select {
            margin-top: var(--bb-grid-size);
            padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
            border-radius: var(--bb-grid-size-16);
            cursor: pointer;
            background: var(--light-dark-n-0);
            color: var(--light-dark-n-100);
            border: none;

            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }
        }
      }
    `,
  ];

  #loadTask: Task<
    readonly [Promise<Readonly<RuntimeFlags>> | null],
    Readonly<RuntimeFlags> | null
  > | null = null;

  #createLoadTask() {
    return new Task(this, {
      task: async ([flags]) => {
        if (!flags) {
          return null;
        }

        return await flags;
      },
      args: () => [this.flags],
    });
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("flags") && this.flags) {
      this.#loadTask = this.#createLoadTask();
    }
  }

  render() {
    if (!this.#loadTask) {
      return nothing;
    }

    return this.#loadTask.render({
      complete: (runtimeFlags) => {
        if (!runtimeFlags) {
          return html`Unable to load flags`;
        }

        const flags = Object.entries(runtimeFlags).sort(([aName], [bName]) => {
          const aTitle =
            RUNTIME_FLAG_META[aName as keyof RuntimeFlags]?.title ?? aName;
          const bTitle =
            RUNTIME_FLAG_META[bName as keyof RuntimeFlags]?.title ?? bName;
          return aTitle.localeCompare(bTitle);
        });

        return html`
          <p class="sans-flex w-400 md-body-medium">
            By enabling these features you may introduce instability or lose
            work in ${Strings.from("APP_NAME")}. Please proceed with caution.
          </p>
          <form @submit=${(evt: SubmitEvent) => evt.preventDefault()}>
            ${repeat(
              flags,
              ([flag]) => flag,
              ([name, value]) => {
                const meta = RUNTIME_FLAG_META[name as keyof RuntimeFlags];
                const title = meta?.title ?? name;
                const description = meta?.description;
                return html` <div class="entry">
                  <div class="flag-info">
                    <label class="sans-flex round w-400" for=${name}
                      >${title}</label
                    >
                    ${description
                      ? html`<span class="flag-description sans-flex w-400"
                          >${description}</span
                        >`
                      : nothing}
                  </div>
                  <select
                    id=${name}
                    name=${name}
                    type="checkbox"
                    class="sans-flex round w-400"
                    .checked=${value}
                    @change=${(evt: InputEvent) => {
                      if (!(evt.target instanceof HTMLSelectElement)) {
                        return;
                      }

                      let value: boolean | undefined;
                      if (evt.target.value !== "default") {
                        value = evt.target.value === "enabled";
                      }

                      this.dispatchEvent(
                        new StateEvent({
                          eventType: "host.flagchange",
                          flag: name as keyof RuntimeFlags,
                          value,
                        })
                      );
                    }}
                  >
                    <option value="default">Default</option>
                    <option ?selected=${value === true} value="enabled">
                      Enabled
                    </option>
                    <option ?selected=${value === false} value="disabled">
                      Disabled
                    </option>
                  </select>
                </div>`;
              }
            )}
          </form>
        </bb-modal>`;
      },
    });
  }
}
