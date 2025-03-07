/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import {
  type SideBoardRuntime,
  sideBoardRuntime,
} from "../../utils/side-board-runtime.js";
import {
  GraphDescriptor,
  InlineDataCapabilityPart,
  InputValues,
  LLMContent,
  OutputValues,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import GenerateAppTheme from "@breadboard-ai/shared-ui/bgl/generate-app-theme.bgl.json" with { type: "json" };
import MarkdownIt from "markdown-it";
import {
  AppTemplateAdditionalOptionsAvailable,
  AppTheme,
  AppThemeColors,
} from "../../types/types.js";
import { ThemeChangeEvent, ThemeClearEvent } from "../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { map } from "lit/directives/map.js";
import { styleMap } from "lit/directives/style-map.js";

@customElement("bb-app-theme-creator")
export class AppThemeCreator extends LitElement {
  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor additionalOptions: AppTemplateAdditionalOptionsAvailable | null =
    null;

  @property()
  accessor theme: AppTheme | null = null;

  @property()
  accessor template: string | null = null;

  @property()
  accessor templates: Array<{ title: string; value: string }> = [];

  @property()
  accessor templateAdditionalOptionsChosen: Record<string, string> = {};

  @consume({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime | undefined;

  @state()
  accessor _generating = false;

  @state()
  accessor _changed = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 25svw;
      min-width: 280px;
      max-width: 360px;
      user-select: none;
    }

    #container {
      display: flex;
      flex-direction: column;
    }

    details {
      border-bottom: 1px solid var(--bb-neutral-100);
      padding: var(--bb-grid-size-2) 0;

      &:last-of-type {
        border-bottom: none;
      }

      & > div {
        display: grid;
        grid-template-columns: 2fr 5fr;
        column-gap: var(--bb-grid-size-2);
        padding: var(--bb-grid-size) var(--bb-grid-size-3);

        &.vertical-stack {
          grid-template-columns: minmax(0, 1fr);
          row-gap: var(--bb-grid-size-2);

          & .controls {
            display: flex;
            align-items: center;
          }
        }

        & label {
          font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
          padding-top: var(--bb-grid-size);
        }
      }

      & input[type="text"],
      & input[type="number"],
      & textarea,
      & select {
        display: block;
        width: 100%;
        border-radius: var(--bb-grid-size);
        background: var(--bb-neutral-0);
        color: var(--bb-neutral-900);
        padding: var(--bb-grid-size-2);
        border: 1px solid var(--bb-neutral-300);
        resize: none;

        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
      }

      textarea {
        field-sizing: content;
      }

      &#appearance {
        & summary {
          padding-left: var(--bb-grid-size-8);
          background: var(--bb-icon-palette) 8px center / 20px 20px no-repeat;
          display: flex;
          align-items: center;
          justify-content: space-between;

          & #reset {
            width: 20px;
            height: 20px;
            background: var(--bb-neutral-0) var(--bb-icon-replay) center
              center / 20px 20px no-repeat;
            opacity: 0.5;
            font-size: 0;

            &:not([disabled]) {
              transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

              &:hover,
              &:focus {
                opacity: 1;
              }
            }
          }
        }

        & input {
          clip: rect(0, 0, 1px, 1px);
          opacity: 0;
          pointer-events: none;
        }

        & label {
          display: flex;
          justify-content: space-between;
          position: relative;

          &:has(+ input[type="color"])::after {
            content: "";
            display: block;
            width: 20px;
            height: 20px;
            background: var(--color);
            border-radius: 50%;
            position: absolute;
            right: -28px;
            border: 1px solid var(--bb-neutral-300);
            opacity: 0.5;
          }

          &:has(+ input[type="color"]:not([disabled]))::after {
            opacity: 1;
            cursor: pointer;
          }

          &:has(+ input:focus)::after {
            border: 1px solid var(--bb-ui-700);
            outline: 1px solid var(--bb-ui-700);
          }
        }

        & button#generate {
          padding-left: var(--bb-grid-size-8);
          background: var(--bb-neutral-50) var(--bb-add-icon-generative) 8px
            center / 20px 20px no-repeat;
          margin-bottom: var(--bb-grid-size-4);

          &:not([disabled]) {
            &:hover,
            &:focus {
              background-color: var(--bb-neutral-100);
            }
          }
        }
      }

      &#application-details summary {
        padding-left: var(--bb-grid-size-8);
        background: var(--bb-icon-phone) 8px center / 20px 20px no-repeat;
      }
    }

    #generate-status {
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-7);
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-700);
      padding-left: var(--bb-grid-size-8);
      margin-left: var(--bb-grid-size-2);
      flex: 1;
      background: url(/images/progress-ui.svg) 8px center / 20px 20px no-repeat;
      margin-bottom: var(--bb-grid-size-4);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size) var(--bb-grid-size-3);
      cursor: pointer;
    }

    button {
      display: block;
      font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);

      border-radius: var(--bb-grid-size-16);
      color: var(--bb-neutral-900);
      background-color: var(--bb-neutral-50);
      border: none;
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size-3);
      transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

      &:not([disabled]) {
        cursor: pointer;

        &:hover,
        &:focus {
          background-color: var(--bb-neutral-100);
        }
      }
    }

    #controls {
      border-top: 1px solid var(--bb-neutral-300);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      display: flex;

      & button {
        margin-right: var(--bb-grid-size-2);
      }
    }
  `;

  #generateDescriptionRef: Ref<HTMLTextAreaElement> = createRef();
  #containerRef: Ref<HTMLDivElement> = createRef();

  #isValidAppTheme(theme: unknown): theme is AppThemeColors {
    const maybeTheme = theme as AppThemeColors;
    const primary = "primaryColor" in maybeTheme;
    const secondary = "secondaryColor" in maybeTheme;
    const background = "backgroundColor" in maybeTheme;
    const text = "textColor" in maybeTheme;
    const primaryText = "primaryTextColor" in maybeTheme;

    return primary && secondary && background && text && primaryText;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      changedProperties.has("appTitle") ||
      changedProperties.has("appDescription") ||
      changedProperties.has("theme") ||
      changedProperties.has("templateAdditionalOptionsChosen")
    ) {
      this._changed = true;
    }
  }

  async #generateTheme(
    appName: string,
    appDescription?: string,
    additionalInformation?: string
  ): Promise<AppTheme> {
    if (!this.sideBoardRuntime) {
      throw new Error("Internal error: No side board runtime was available.");
    }
    const runner = await this.sideBoardRuntime.createRunner(
      {
        ...(GenerateAppTheme as GraphDescriptor),
      },
      this.graph?.url
    );
    const inputs: InputValues & { context: LLMContent[] } = {
      context: [
        {
          role: "user",
          parts: [
            {
              text: `ULTRA IMPORTANT: The application's name is: "${appName}".`,
            },
          ],
        },
      ],
    };

    if (additionalInformation) {
      inputs.context[0].parts.push({
        text: `The app does the following: "${appDescription}"`,
      });
    }

    if (additionalInformation) {
      inputs.context[0].parts.push({ text: additionalInformation });
    }

    const outputs = await new Promise<OutputValues[]>((resolve, reject) => {
      const outputs: OutputValues[] = [];
      runner.addEventListener("input", () => void runner.run(inputs));
      runner.addEventListener("output", (event) =>
        outputs.push(event.data.outputs)
      );
      runner.addEventListener("end", () => resolve(outputs));
      runner.addEventListener("error", (event) => reject(event.data.error));
      void runner.run();
    });

    if (outputs.length !== 1) {
      throw new Error(`Expected 1 output, got ${JSON.stringify(outputs)}`);
    }

    const [response] = outputs[0].context as LLMContent[];

    // The splash image.
    const splashScreen = response.parts[0] as InlineDataCapabilityPart;
    const colorsRaw = response.parts[1] as TextCapabilityPart;
    const codeRaw = MarkdownIt()
      .renderInline(colorsRaw.text, {})
      .replace(/&quot;/gim, '"')
      .replace(/\n/gim, "");

    const matches = /.*?({.*?})/gim.exec(codeRaw);
    if (!matches) {
      throw new Error("Invalid color scheme generated");
    }

    try {
      const code = JSON.parse(matches[1]) as AppThemeColors;
      if (!this.#isValidAppTheme(code)) {
        throw new Error("Invalid color scheme generated");
      }

      return {
        ...code,
        splashScreen,
      };
    } catch (err) {
      throw new Error("Invalid color scheme generated");
    }
  }

  async #debounceGenerateTheme() {
    try {
      if (this._generating) {
        return;
      }

      this._generating = true;
      this.theme = await this.#generateTheme(
        this.appTitle ?? "Untitled Application",
        this.appDescription ?? undefined,
        this.#generateDescriptionRef.value?.value
      );
    } catch (err) {
      console.warn(err);
    } finally {
      this._generating = false;
    }
  }

  render() {
    return html`<section id="container" ${ref(this.#containerRef)}>
      <details id="application-details">
        <summary>Application Details</summary>
        <div>
          <label for="app-title">Title</label>
          <input
            id="app-title"
            type="text"
            placeholder="Your application's title"
            autocomplete="off"
            required
            .value=${this.appTitle}
            ?disabled=${this._generating}
            @input=${(evt: InputEvent) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              this.appTitle = evt.target.value ?? "Untitled Application";
            }}
          />
        </div>
        <div>
          <label for="app-description">Description</label>
          <textarea
            autocomplete="off"
            placeholder="Describe your app"
            id="app-description"
            .value=${this.appDescription}
            ?disabled=${this._generating}
            @input=${(evt: InputEvent) => {
              if (!(evt.target instanceof HTMLTextAreaElement)) {
                return;
              }

              this.appDescription = evt.target.value ?? "";
            }}
          ></textarea>
        </div>
      </details>
      <details id="appearance" open>
        <summary>
          Appearance
          <button
            ?disabled=${this._generating}
            id="reset"
            @click=${() => {
              if (!this.theme) {
                return;
              }

              this._changed = false;
              this.dispatchEvent(new ThemeClearEvent());
            }}
          >
            Reset all styles
          </button>
        </summary>

        <div class="vertical-stack">
          <textarea
            autocomplete="off"
            placeholder="Describe your theme"
            ${ref(this.#generateDescriptionRef)}
            @keydown=${async (evt: KeyboardEvent) => {
              const isMac = navigator.platform.indexOf("Mac") === 0;
              const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

              if (!(evt.key === "Enter" && isCtrlCommand)) {
                return;
              }
              await this.#debounceGenerateTheme();
            }}
            ?disabled=${this._generating}
          ></textarea>
          <div class="controls">
            <button
              ?disabled=${this._generating}
              id="generate"
              @click=${async () => {
                await this.#debounceGenerateTheme();
              }}
            >
              Generate
            </button>
            ${this._generating
              ? html`<div id="generate-status">Generating theme...</div>`
              : nothing}
          </div>
        </div>

        <div>
          <label for="template">Template</label>
          <select id="template" ?disabled=${this._generating}>
            ${map(
              this.templates,
              (template) =>
                html`<option
                  .value=${template.value}
                  ?selected=${template.value === this.template}
                >
                  ${template.title}
                </option>`
            )}
          </select>
        </div>
        ${this.additionalOptions
          ? html`${repeat(
              Object.entries(this.additionalOptions),
              ([name, option]) => {
                return html`<div>
                  <label for="${name}">${option.title}</label>
                  <select
                    id="${name}"
                    ?disabled=${this._generating}
                    @input=${(evt: InputEvent) => {
                      if (!(evt.target instanceof HTMLSelectElement)) {
                        return;
                      }

                      this.templateAdditionalOptionsChosen = {
                        ...this.templateAdditionalOptionsChosen,
                        [name]: evt.target.value,
                      };
                    }}
                  >
                    ${map(option.values, ({ value, title }) => {
                      const selected =
                        this.templateAdditionalOptionsChosen[name] === value;

                      return html`<option ?selected=${selected} .value=${value}>
                        ${title}
                      </option>`;
                    })}
                  </select>
                </div>`;
              }
            )}`
          : nothing}
        ${this.theme
          ? html` <div>
                <label
                  for="primary"
                  style=${styleMap({ "--color": this.theme.primaryColor })}
                  >Primary</label
                >
                <input
                  id="primary"
                  type="color"
                  ?disabled=${this._generating}
                  .value=${this.theme.primaryColor}
                  @input=${(evt: InputEvent) => {
                    if (
                      !(evt.target instanceof HTMLInputElement) ||
                      !this.theme
                    ) {
                      return;
                    }

                    this.theme = {
                      ...this.theme,
                      primaryColor: evt.target.value,
                    };
                  }}
                />
              </div>
              <div>
                <label
                  for="secondary"
                  style=${styleMap({ "--color": this.theme.secondaryColor })}
                  >Secondary</label
                >
                <input
                  id="secondary"
                  type="color"
                  ?disabled=${this._generating}
                  .value=${this.theme.secondaryColor}
                  @input=${(evt: InputEvent) => {
                    if (
                      !(evt.target instanceof HTMLInputElement) ||
                      !this.theme
                    ) {
                      return;
                    }

                    this.theme = {
                      ...this.theme,
                      secondaryColor: evt.target.value,
                    };
                  }}
                />
              </div>
              <div>
                <label
                  for="background"
                  style=${styleMap({ "--color": this.theme.backgroundColor })}
                  >Background</label
                >
                <input
                  id="background"
                  type="color"
                  ?disabled=${this._generating}
                  .value=${this.theme.backgroundColor}
                  @input=${(evt: InputEvent) => {
                    if (
                      !(evt.target instanceof HTMLInputElement) ||
                      !this.theme
                    ) {
                      return;
                    }

                    this.theme = {
                      ...this.theme,
                      backgroundColor: evt.target.value,
                    };
                  }}
                />
              </div>
              <div>
                <label
                  for="primary-text"
                  style=${styleMap({ "--color": this.theme.primaryTextColor })}
                  >Primary Text</label
                >
                <input
                  id="primary-text"
                  type="color"
                  ?disabled=${this._generating}
                  .value=${this.theme.primaryTextColor}
                  @input=${(evt: InputEvent) => {
                    if (
                      !(evt.target instanceof HTMLInputElement) ||
                      !this.theme
                    ) {
                      return;
                    }

                    this.theme = {
                      ...this.theme,
                      primaryTextColor: evt.target.value,
                    };
                  }}
                />
              </div>
              <div>
                <label
                  for="text"
                  style=${styleMap({ "--color": this.theme.textColor })}
                  >Text</label
                >
                <input
                  id="text"
                  type="color"
                  ?disabled=${this._generating}
                  .value=${this.theme.textColor}
                  @input=${(evt: InputEvent) => {
                    if (
                      !(evt.target instanceof HTMLInputElement) ||
                      !this.theme
                    ) {
                      return;
                    }

                    this.theme = {
                      ...this.theme,
                      textColor: evt.target.value,
                    };
                  }}
                />
              </div>`
          : nothing}
      </details>

      ${this._changed
        ? html` <aside id="controls">
            <button
              ?disabled=${!this._changed || this._generating}
              @click=${() => {
                if (!this.theme) {
                  return;
                }

                this._changed = false;
                this.dispatchEvent(
                  new ThemeChangeEvent(
                    this.theme,
                    this.appTitle,
                    this.appDescription,
                    this.template,
                    this.templateAdditionalOptionsChosen
                  )
                );
              }}
            >
              Update theme
            </button>
          </aside>`
        : nothing}
    </section>`;
  }
}
