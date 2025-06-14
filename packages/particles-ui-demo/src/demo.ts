/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { styles } from "./ui/styles";
import { UITheme } from "./ui/theme/default.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { merge } from "./ui/styles/utils";

import "./ui/elements/button.js";
import { createParticles, createSpec } from "./gemini";

@customElement("goal-demo")
export class GoalDemo extends LitElement {
  @property()
  accessor theme: UITheme | null = null;

  @property()
  accessor colors: Record<string, string> | null = null;

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
    styles,
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
    `,
  ];

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
    this.#spec.value = await createSpec(this.#goal.value);
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

    this.#processingSpec = true;
    this.#output.textContent = await createParticles(this.#spec.value);
    this.#processingSpec = false;
  }

  render() {
    if (!this.theme) {
      return nothing;
    }

    const working = this.#processingSpec || this.#processingGoal;

    return html`<section
      style=${styleMap(this.colors ? this.colors : {})}
      class="color-bgc-n100 typography-f-s layout-el-cv behavior-o-a"
    >
      <div class="layout-p-16 layout-flx-vert layout-el-cv">
        <h1
          class=${classMap(
            merge(this.theme.elements.h1, {
              "typography-sz-ds": true,
              "layout-mb-6": true,
            })
          )}
        >
          Particle UI Demo
        </h1>
        <section id="main" class="layout-flx-vert layout-g-20 layout-flx-1">
          <div
            id="outputs"
            class="layout-grd layout-grd-col3 layout-g-8 layout-flx-1"
            style=${styleMap({
              "grid-template-columns": "1fr min-content 1fr",
            })}
          >
            <textarea
              name="spec"
              id="spec"
              ?disabled=${working}
              class=${classMap(
                merge(this.theme.elements.textarea, {
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
            ></textarea>
            <div
              class=${classMap({
                "layout-flx-hor": true,
                "layout-al-c": true,
              })}
            >
              <ui-button
                class=${classMap(
                  merge(theme.elements.button, {
                    "layout-pl-6": true,
                    "layout-pr-4": true,
                    "layout-al-c": true,
                    "typography-s-bs": true,
                  })
                )}
                .icon=${"sync_alt"}
                .showSpinnerWhenDisabled=${this.#processingSpec}
                ?disabled=${working}
                @click=${async () => {
                  if (working) {
                    return;
                  }
                  await this.#processSpec();
                }}
              >
              </ui-button>
            </div>
            <div
              id="output"
              class=${classMap(
                merge(this.theme.elements.p, {
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
              style=${styleMap({ "white-space": "pre" })}
            ></div>
          </div>
          <div id="input" class="layout-flx-hor layout-sp-c">
            <input
              name="goal"
              type="text"
              id="goal"
              .value=${"Write UI for an item in a TODO list with pictures"}
              ?disabled=${working}
              class=${classMap(
                merge(this.theme.elements.input, {
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
              placeholder="What is your goal?"
              @keydown=${async (evt: KeyboardEvent) => {
                if (evt.key === "Enter") {
                  await this.#processGoal();
                }
              }}
            />
            <ui-button
              class=${classMap(
                merge(theme.elements.button, {
                  "layout-pl-6": true,
                  "layout-pr-6": true,
                  "layout-al-c": true,
                })
              )}
              .icon=${"send"}
              .showSpinnerWhenDisabled=${this.#processingGoal}
              ?disabled=${working}
              @click=${async () => {
                await this.#processGoal();
              }}
            >
              Send
            </ui-button>
          </div>
        </section>
      </div>
    </section>`;
  }
}

const { theme } = await import("./ui/theme/default.js");
const demo = new GoalDemo();
demo.theme = theme;
demo.colors = theme.colors;
document.body.appendChild(demo);
