/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { provide } from "@lit/context";

import * as ParticlesUI from "@breadboard-ai/particles-ui";

import { createParticles, createSpec } from "./gemini";
import { List } from "./state/list";
import { Item } from "./state/item";
import { UiReceiver } from "./ui/ui-receiver";

function isCtrlCommand(evt: PointerEvent | KeyboardEvent | WheelEvent) {
  const isMac = navigator.platform.indexOf("Mac") === 0;
  return isMac ? evt.metaKey : evt.ctrlKey;
}

const GOAL_KEY = "particle-demo-goal";
const SPEC_KEY = "particle-demo-spec";
const DEFAULT_GOAL =
  'Write UI for a list of editable items in an editable TODO list. Each item in the list must have a picture, title, description, due date and a "Delete" action.';

@customElement("goal-demo")
export class GoalDemo extends LitElement {
  @provide({ context: ParticlesUI.Context.themeContext })
  accessor theme: ParticlesUI.Types.UITheme | undefined;

  @property()
  accessor additionalStyles: Record<string, string> | null = null;

  @query("#spec")
  accessor #spec: HTMLTextAreaElement | null = null;

  @query("#goal")
  accessor #goal: HTMLInputElement | null = null;

  @query("#output")
  accessor #output: HTMLElement | null = null;

  @state()
  accessor #processingGoal = false;

  @state()
  accessor #processingSpec = false;

  static styles = [
    ParticlesUI.Styles.all,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: grid;
        width: 100svw;
        height: 100svh;
        max-width: 1600px;
        margin: 0 auto;
        overflow: auto;
      }

      #outputs {
        position: relative;

        details {
          border-radius: var(--g-3);
          background: var(--n-98);
          width: 100%;
          overflow: scroll;
          color: var(--n-40);

          & pre {
            padding: var(--g-2);
            font-size: 12px;
            margin: 0;
          }

          & summary {
            cursor: pointer;
            user-select: none;
            padding: var(--g-3);
            font-size: 12px;
            background: var(--n-95);
            border-radius: var(--g-3);
          }
        }

        &::before {
          content: "Spec";
          text-transform: uppercase;
          font-size: 11px;
          font-family: var(--font-family-mono);
          background: var(--n-98);
          color: var(--n-60);
          position: absolute;
          top: -32px;
          left: 10px;
          height: 24px;
          display: flex;
          align-items: center;
          padding: 0 var(--g-5);
          border-radius: var(--g-1);
        }

        &::after {
          content: "Output";
          text-transform: uppercase;
          font-size: 11px;
          font-family: var(--font-family-mono);
          background: var(--n-98);
          color: var(--n-60);
          position: absolute;
          top: -32px;
          left: calc(53% + 32px);
          height: 24px;
          display: flex;
          align-items: center;
          padding: 0 var(--g-5);
          border-radius: var(--g-1);
        }
      }
    `,
  ];

  #lastSpec: string | null = null;
  #lastGoal: string | null = null;
  connectedCallback(): void {
    super.connectedCallback();
    const lastSpec = localStorage.getItem(SPEC_KEY);
    if (lastSpec !== null) {
      this.#lastSpec = lastSpec;
    }
    const lastGoal = localStorage.getItem(GOAL_KEY);
    if (lastGoal !== null) {
      this.#lastGoal = lastGoal;
    }
  }

  async #processGoal() {
    if (
      !this.#goal ||
      !this.#spec ||
      this.#processingGoal ||
      this.#processingSpec
    ) {
      return;
    }

    this.#processingGoal = true;
    this.#persistSpec(await createSpec(this.#goal.value));
    this.#spec.value = this.#lastSpec ?? "";
    this.#processingGoal = false;
  }

  async #processSpec() {
    if (
      !this.#spec ||
      !this.#output ||
      this.#processingGoal ||
      this.#processingSpec
    ) {
      return;
    }

    if (this.#spec.value.trim() === "") {
      return;
    }

    this.#processingSpec = true;
    const code = (await createParticles(this.#spec.value))
      .replace(/^```javascript/gim, "")
      .replace(/```$/gim, "");

    try {
      const list = new List();

      let data = eval(`${code};invoke()`);
      if (Array.isArray(data)) {
        data = data[0];
      }

      console.log("DATA", data);

      if ("items" in data) {
        for (const item of data.items) {
          const i = Item.from(item);
          list.items.set(globalThis.crypto.randomUUID(), i);
        }

        if ("presentation" in data) {
          list.presentation = { ...data.presentation };
        }
      } else {
        const i = Item.from(data);
        list.items.set(globalThis.crypto.randomUUID(), i);
      }

      // TODO: Make this selectable.
      // let theme:ParticlesUI.Types. UITheme;
      // const params = new URLSearchParams(window.location.search);
      // if (params.get("dark")) {
      //   const { theme: loadedTheme } = await import(
      //     "./ui/theme/default/dark.js"
      //   );
      //   theme = loadedTheme;
      // } else if (params.get("alternative")) {
      //   const { theme: loadedTheme } = await import(
      //     "./ui/theme/alternative/dark.js"
      //   );
      //   theme = loadedTheme;
      // } else {
      const { theme: loadedTheme } = await import(
        "./ui/theme/default/light.js"
      );
      const theme = loadedTheme;
      // }
      const uiReceiver = new UiReceiver();
      uiReceiver.list = list;
      uiReceiver.theme = theme;
      uiReceiver.additionalStyles = {}; //theme.additionalStyles;

      this.#output.textContent = "";
      this.#output.appendChild(uiReceiver);
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Spec output";
      details.appendChild(summary);
      const pre = document.createElement("pre");
      pre.textContent = code;
      details.appendChild(pre);
      this.#output.appendChild(details);
    } catch (err) {
      console.warn(err);
    }

    this.#processingSpec = false;
  }

  #persistSpec(spec: string) {
    this.#lastSpec = spec;
    localStorage.setItem(SPEC_KEY, spec);
  }

  #persistGoal(goal: string) {
    this.#lastGoal = goal;
    localStorage.setItem(GOAL_KEY, goal);
  }

  render() {
    if (!this.theme) {
      return nothing;
    }

    const working = this.#processingSpec || this.#processingGoal;

    return html`<section
      style=${styleMap(this.additionalStyles ? this.additionalStyles : {})}
      class="color-bgc-n100 typography-f-s layout-el-cv behavior-o-a"
    >
      <div class="layout-p-8 layout-dsp-flexvert layout-el-cv">
        <h1
          class=${classMap(
            ParticlesUI.Utils.merge(this.theme.elements.h1, {
              "typography-sz-ds": true,
              "layout-mb-6": true,
            })
          )}
        >
          Particle UI Demo
        </h1>
        <section
          id="main"
          class="layout-dsp-flexvert layout-al-n layout-g-14 layout-flx-1"
        >
          <div
            id="outputs"
            class="layout-dsp-grid layout-grd-col3 layout-g-8 layout-flx-1 layout-mt-6"
            style=${styleMap({
              "grid-template-columns": "1fr min-content 1fr",
            })}
          >
            <textarea
              name="spec"
              id="spec"
              ?disabled=${working}
              .value=${this.#lastSpec ?? ""}
              @input=${(evt: InputEvent) => {
                if (!(evt.target instanceof HTMLTextAreaElement)) {
                  return;
                }

                this.#persistSpec(evt.target.value);
              }}
              class=${classMap(
                ParticlesUI.Utils.merge(this.theme.elements.textarea, {
                  "layout-fs-n": true,
                  "border-br-2": true,
                  "border-bw-0": true,
                  "color-bgc-n98": true,
                  "typography-f-c": true,
                  "layout-pt-3": true,
                  "layout-pb-3": true,
                  "layout-pl-3": true,
                  "layout-pr-3": true,
                })
              )}
              @keydown=${async (evt: KeyboardEvent) => {
                if (evt.key === "Enter" && isCtrlCommand(evt)) {
                  await this.#processSpec();
                }
              }}
            ></textarea>
            <div
              class=${classMap({
                "layout-dsp-flexhor": true,
                "layout-al-c": true,
              })}
            >
              <particle-ui-button
                class=${classMap({
                  "layout-al-c": true,
                  "typography-s-bs": true,
                })}
                .value=${""}
                .field=${{ title: "", icon: "sync_alt", as: "" }}
                .showSpinnerWhenDisabled=${this.#processingSpec}
                ?disabled=${working}
                @click=${async () => {
                  if (working) {
                    return;
                  }
                  await this.#processSpec();
                }}
              >
              </particle-ui-button>
            </div>
            <div
              id="output"
              class=${classMap(
                ParticlesUI.Utils.merge(this.theme.elements.p, {
                  "layout-fs-n": true,
                  "layout-p-3": true,
                  "border-br-2": true,
                  "border-bw-1": true,
                  "border-bs-s": true,
                  "color-bc-n90": true,
                  "behavior-o-a": true,
                  "layout-c-s": true,
                  "typography-f-c": true,
                })
              )}
            ></div>
          </div>
          <div id="input" class="layout-dsp-flexhor layout-sp-c">
            <input
              name="goal"
              type="text"
              id="goal"
              autofocus
              .value=${this.#lastGoal ?? DEFAULT_GOAL}
              ?disabled=${working}
              class=${classMap(
                ParticlesUI.Utils.merge(this.theme.elements.input, {
                  "typography-sz-bl": true,
                  "border-bw-2": true,
                  "border-br-12": true,
                  "color-bc-s80": true,
                  "layout-p-0": true,
                  "layout-pt-3": true,
                  "layout-pb-3": true,
                  "layout-pl-6": true,
                  "layout-pr-6": true,
                  "layout-flx-1": true,
                  "layout-mr-3": true,
                })
              )}
              style=${styleMap({ "max-width": "800px" })}
              autocomplete="off"
              placeholder="What would you like to create?"
              @keydown=${async (evt: KeyboardEvent) => {
                if (evt.key === "Enter") {
                  await this.#processGoal();
                }
              }}
              @input=${(evt: InputEvent) => {
                if (!(evt.target instanceof HTMLInputElement)) {
                  return;
                }

                this.#persistGoal(evt.target.value);
              }}
            />
            <particle-ui-button
              class=${classMap({
                "layout-pl-3": true,
                "layout-pr-6": true,
                "layout-al-c": true,
              })}
              .value=${"Send"}
              .field=${{ title: "Send", icon: "send", as: "" }}
              ?disabled=${working}
              @click=${async () => {
                await this.#processGoal();
              }}
            >
            </particle-ui-button>
          </div>
        </section>
      </div>
    </section>`;
  }
}

const { theme } = await import("./ui/theme/default/light.js");
const demo = new GoalDemo();
demo.theme = theme;
demo.additionalStyles = theme.additionalStyles ?? null;
document.body.appendChild(demo);
