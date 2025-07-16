/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { StateEvent } from "../../events/events";
import { RuntimeFlags } from "@breadboard-ai/types";
import { Task } from "@lit/task";
import { repeat } from "lit/directives/repeat.js";

@customElement("bb-runtime-flags-modal")
export class VERuntimeFlagsModal extends LitElement {
  @property()
  accessor flags: Promise<Readonly<RuntimeFlags>> | null = null;

  static styles = [
    type,
    colorsLight,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      form {
        display: grid;
        align-items: center;
        row-gap: var(--bb-grid-size-3);
        width: 80svw;
        max-width: 380px;

        & .entry {
          display: grid;
          grid-template-columns: 1fr 120px;
          align-items: center;

          & select {
            padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
            border-radius: var(--bb-grid-size-16);
            cursor: pointer;
            background: var(--n-0);
            color: var(--n-100);
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

        return html`<bb-modal
          .modalTitle=${"Experiments"}
          .showCloseButton=${true}
          .showSaveCancel=${false}
        >
          <form @submit=${(evt: SubmitEvent) => evt.preventDefault()}>
            ${repeat(Object.entries(runtimeFlags), ([name, value]) => {
              return html` <div class="entry">
                <label class="sans-flex round w-400" for=${name}>${name}</label>
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
            })}
          </form>
        </bb-modal>`;
      },
    });
  }
}
