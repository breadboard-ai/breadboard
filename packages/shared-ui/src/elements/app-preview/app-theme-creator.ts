/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import {
  GraphDescriptor,
  GraphTheme,
  InputValues,
  LLMContent,
  OutputValues,
} from "@breadboard-ai/types";
import GenerateAppTheme from "@breadboard-ai/shared-ui/bgl/generate-app-theme.bgl.json" with { type: "json" };
import MarkdownIt from "markdown-it";
import {
  AppTemplateAdditionalOptionsAvailable,
  AppTheme,
  AppThemeColors,
} from "../../types/types.js";
import {
  OverlayDismissedEvent,
  ThemeChangeEvent,
  ThemeCreateEvent,
  ThemeDeleteEvent,
  ThemeUpdateEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { sideBoardRuntime } from "../../contexts/side-board-runtime.js";
import { SideBoardRuntime } from "../../sideboards/types.js";
import { classMap } from "lit/directives/class-map.js";
import { isInlineData, isTextCapabilityPart } from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";

@customElement("bb-app-theme-creator")
export class AppThemeCreator extends LitElement {
  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor themeHash: string | null = null;

  @property()
  accessor theme: string | null = null;

  @property()
  accessor themeOptions: AppTemplateAdditionalOptionsAvailable | null = null;

  @state()
  accessor themes: Record<string, GraphTheme> | null = null;

  @state()
  accessor templates: Array<{ title: string; value: string }> = [];

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
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);

      & h1 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
          var(--bb-font-family);
        padding: 0 var(--bb-grid-size-3);
        height: var(--bb-grid-size-12);
        border-bottom: 1px solid var(--bb-neutral-300);
        margin: 0;

        & span {
          flex: 1;
          background: var(--bb-icon-palette) 4px center / 20px 20px no-repeat;
          padding: 0 var(--bb-grid-size-8);
        }

        & #close {
          width: 20px;
          height: 20px;
          background: var(--bb-icon-close) center center / 20px 20px no-repeat;
          font-size: 0;
          border: none;
          opacity: 0.6;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              opacity: 1;
            }
          }
        }
      }

      #generate-theme,
      #theme-selector {
        & h2 {
          font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
            var(--bb-font-family);
          margin: 0 0 var(--bb-grid-size-2) 0;
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
      }

      #generate-theme {
        padding: var(--bb-grid-size-3);

        & textarea {
          min-height: 44px;
          padding-right: var(--bb-grid-size-12);
          background: var(--bb-add-icon-generative) var(--bb-neutral-0)
            calc(100% - 8px) center / 20px 20px no-repeat;
        }
      }

      #theme-selector {
        & h2 {
          display: flex;
          align-items: center;
          padding: var(--bb-grid-size-3) var(--bb-grid-size-3) 0
            var(--bb-grid-size-3);

          & span {
            flex: 1;
            background: var(--bb-icon-palette) 4px center / 20px 20px no-repeat;
            padding: 0 var(--bb-grid-size-8);
          }

          & button {
            width: 20px;
            height: 20px;
            background: var(--bb-icon-delete) center center / 20px 20px
              no-repeat;
            font-size: 0;
            border: none;
            opacity: 0.6;
            transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:not([disabled]) {
              cursor: pointer;

              &:hover,
              &:focus {
                opacity: 1;
              }
            }
          }
        }

        & menu {
          padding: 3px var(--bb-grid-size-3);
          margin: 0 0 var(--bb-grid-size-3) 0;
          scroll-padding-right: var(--bb-grid-size-3);
          scroll-padding-left: var(--bb-grid-size-3);

          list-style: none;
          display: flex;
          overflow: scroll;
          scrollbar-width: none;

          & li {
            margin-right: var(--bb-grid-size-3);

            &:last-of-type {
              margin-right: 0;
            }

            & button {
              padding: 0;
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              width: 102px;
              border: 1px solid var(--bb-neutral-0);
              outline: 1px solid var(--bb-neutral-500);
              background: var(--bb-neutral);
              border-radius: var(--bb-grid-size-2);

              &.selected {
                outline: 3px solid var(--bb-ui-500);
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  outline: 3px solid var(--bb-ui-500);
                }
              }

              & img {
                width: 100px;
                grid-column: 1 / 6;
                aspect-ratio: 1 / 1;
                object-fit: cover;
                background: url(/images/progress-ui.svg) center center / 20px
                  20px no-repeat;
                border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
              }

              & .color {
                width: 20px;
                height: 20px;
                background-color: var(--background);

                &:first-of-type {
                  border-radius: 0 0 0 var(--bb-grid-size-2);
                }

                &:last-of-type {
                  border-radius: 0 0 var(--bb-grid-size-2) 0;
                }
              }
            }
          }
        }

        & #theme-options,
        & #theme-colors {
          padding: 0 var(--bb-grid-size-3);

          & > div {
            display: grid;
            grid-template-columns: 80px 1fr;
            column-gap: var(--bb-grid-size-2);
            align-items: center;
            margin-bottom: var(--bb-grid-size-3);
          }

          & label {
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
            white-space: nowrap;
          }

          input[type="color"] {
            width: 20px;
            height: 20px;
            padding: 0;
            border: 1px solid var(--bb-neutral-200);
            border-radius: 0;
          }

          input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
            border: none;
            width: 20px;
            height: 20px;
          }

          input[type="color"]::-webkit-color-swatch {
            padding: 0;
            border: none;
            width: 20px;
            height: 20px;
          }

          input[type="color"]::-moz-color-swatch-wrapper {
            padding: 0;
            border: none;
            width: 20px;
            height: 20px;
          }

          input[type="color"]::-moz-color-swatch {
            padding: 0;
            border: none;
            width: 20px;
            height: 20px;
          }
        }
      }
    }

    details {
      border-bottom: 1px solid var(--bb-neutral-100);
      padding: var(--bb-grid-size-2) 0;

      & &:last-of-type {
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
      margin: var(--bb-grid-size-2) 0;
      flex: 1;
      background: url(/images/progress-ui.svg) 8px center / 20px 20px no-repeat;
    }
  `;

  #selectedThemeRef: Ref<HTMLButtonElement> = createRef();
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
    if (changedProperties.has("graph") || changedProperties.has("themeHash")) {
      if (this.graph) {
        this.theme = this.graph.metadata?.visual?.presentation?.theme ?? null;
        this.themes = {
          ...(this.graph.metadata?.visual?.presentation?.themes ?? null),
        };
      }
    }

    this._changed = false;
  }

  protected updated(): void {
    if (this.#selectedThemeRef.value) {
      this.#selectedThemeRef.value.scrollIntoView();
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

    if (appDescription) {
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
    const [splashScreen, colorsRaw] = response.parts;
    console.log(splashScreen, colorsRaw);

    if (!isInlineData(splashScreen) || !isTextCapabilityPart(colorsRaw)) {
      throw new Error("Invalid model response");
    }

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
      const newTheme = await this.#generateTheme(
        this.graph?.title ?? "Untitled Application",
        this.graph?.description ?? undefined,
        this.#generateDescriptionRef.value?.value
      );
      this.dispatchEvent(new ThemeCreateEvent(newTheme));
    } catch (err) {
      console.warn(err);
      let errMessage = "Error";
      if (typeof err === "string") {
        errMessage = err;
      } else if (typeof err === "object") {
        errMessage = (err as Error).message ?? "Unknown error";
      }
      this.dispatchEvent(new ToastEvent(errMessage, ToastType.ERROR));
    } finally {
      this._generating = false;
    }
  }

  #emitTheme() {
    if (!this.themes || !this.theme) {
      return;
    }

    if (!this.themes[this.theme]) {
      return;
    }

    const theme = this.themes[this.theme];
    this.dispatchEvent(new ThemeUpdateEvent(this.theme, theme));
  }

  render() {
    if (!this.themes || !this.theme) {
      console.log("No themes found");
      return nothing;
    }

    const theme = this.themes[this.theme];
    return html`<section id="container" ${ref(this.#containerRef)}>
      <h1>
        <span>Designer</span>
        <button
          id="close"
          @click=${() => {
            this.dispatchEvent(new OverlayDismissedEvent());
          }}
        >
          Close
        </button>
      </h1>
      <section id="generate-theme">
        <h2>Generate a theme</h2>
        <textarea
          autocomplete="off"
          placeholder="Describe your theme"
          ${ref(this.#generateDescriptionRef)}
          @keydown=${async (evt: KeyboardEvent) => {
            if (!(evt.key === "Enter")) {
              return;
            }
            await this.#debounceGenerateTheme();
          }}
          ?disabled=${this._changed || this._generating}
        ></textarea>
        ${this._generating
          ? html`<div id="generate-status">Generating new theme...</div>`
          : nothing}
      </section>
      <section id="theme-selector">
        <h2>
          <span>Theme</span>
          <button
            ?disabled=${Object.keys(this.themes).length === 1}
            @click=${() => {
              if (!this.theme) {
                return;
              }

              this.dispatchEvent(new ThemeDeleteEvent(this.theme));
            }}
          >
            Delete theme
          </button>
        </h2>

        <menu>
          ${repeat(
            Object.entries(this.themes),
            ([key]) => key,
            ([key, theme]) => {
              let url = theme.splashScreen?.storedData.handle;
              if (url && url.startsWith(".") && this.graph?.url) {
                url = new URL(url, this.graph?.url).href;
              }

              return html`<li>
                <button
                  ?disabled=${this._changed || this._generating}
                  class=${classMap({ selected: key === this.theme })}
                  ${this.theme === key ? ref(this.#selectedThemeRef) : nothing}
                  @click=${() => {
                    this._changed = true;
                    this.dispatchEvent(new ThemeChangeEvent(key));
                  }}
                >
                  <img
                    src=${url ?? "/images/app/generic-flow.jpg"}
                    alt="Theme thumbnail"
                  />
                  <span
                    class="color"
                    style=${styleMap({
                      "--background": theme.themeColors?.primaryColor,
                    })}
                  ></span>
                  <span
                    class="color"
                    style=${styleMap({
                      "--background": theme.themeColors?.secondaryColor,
                    })}
                  ></span>
                  <span
                    class="color"
                    style=${styleMap({
                      "--background": theme.themeColors?.backgroundColor,
                    })}
                  ></span>
                  <span
                    class="color"
                    style=${styleMap({
                      "--background": theme.themeColors?.primaryTextColor,
                    })}
                  ></span>
                  <span
                    class="color"
                    style=${styleMap({
                      "--background": theme.themeColors?.textColor,
                    })}
                  ></span>
                </button>
              </li>`;
            }
          )}
        </menu>

        <div id="theme-colors">
          ${theme.themeColors
            ? html` <div>
                  <label
                    for="primary"
                    style=${styleMap({
                      "--color": theme.themeColors?.primaryColor,
                    })}
                    >Primary</label
                  >
                  <input
                    id="primary"
                    type="color"
                    ?disabled=${this._changed || this._generating}
                    .value=${theme.themeColors.primaryColor}
                    @input=${(evt: InputEvent) => {
                      if (
                        !(evt.target instanceof HTMLInputElement) ||
                        !theme.themeColors
                      ) {
                        return;
                      }

                      theme.themeColors = {
                        ...theme.themeColors,
                        primaryColor: evt.target.value,
                      };

                      this.#emitTheme();
                    }}
                  />
                </div>
                <div>
                  <label
                    for="secondary"
                    style=${styleMap({
                      "--color": theme.themeColors.secondaryColor,
                    })}
                    >Secondary</label
                  >
                  <input
                    id="secondary"
                    type="color"
                    ?disabled=${this._changed || this._generating}
                    .value=${theme.themeColors.secondaryColor}
                    @input=${(evt: InputEvent) => {
                      if (
                        !(evt.target instanceof HTMLInputElement) ||
                        !theme.themeColors
                      ) {
                        return;
                      }

                      theme.themeColors = {
                        ...theme.themeColors,
                        secondaryColor: evt.target.value,
                      };

                      this.#emitTheme();
                    }}
                  />
                </div>
                <div>
                  <label
                    for="background"
                    style=${styleMap({
                      "--color": theme.themeColors.backgroundColor,
                    })}
                    >Background</label
                  >
                  <input
                    id="background"
                    type="color"
                    ?disabled=${this._changed || this._generating}
                    .value=${theme.themeColors.backgroundColor}
                    @input=${(evt: InputEvent) => {
                      if (
                        !(evt.target instanceof HTMLInputElement) ||
                        !theme.themeColors
                      ) {
                        return;
                      }

                      theme.themeColors = {
                        ...theme.themeColors,
                        backgroundColor: evt.target.value,
                      };

                      this.#emitTheme();
                    }}
                  />
                </div>
                <div>
                  <label
                    for="primary-text"
                    style=${styleMap({
                      "--color": theme.themeColors.primaryTextColor,
                    })}
                    >Primary Text</label
                  >
                  <input
                    id="primary-text"
                    type="color"
                    ?disabled=${this._changed || this._generating}
                    .value=${theme.themeColors.primaryTextColor}
                    @input=${(evt: InputEvent) => {
                      if (
                        !(evt.target instanceof HTMLInputElement) ||
                        !theme.themeColors
                      ) {
                        return;
                      }

                      theme.themeColors = {
                        ...theme.themeColors,
                        primaryTextColor: evt.target.value,
                      };

                      this.#emitTheme();
                    }}
                  />
                </div>
                <div>
                  <label
                    for="text"
                    style=${styleMap({
                      "--color": theme.themeColors.textColor,
                    })}
                    >Text</label
                  >
                  <input
                    id="text"
                    type="color"
                    ?disabled=${this._changed || this._generating}
                    .value=${theme.themeColors.textColor}
                    @input=${(evt: InputEvent) => {
                      if (
                        !(evt.target instanceof HTMLInputElement) ||
                        !theme.themeColors
                      ) {
                        return;
                      }

                      theme.themeColors = {
                        ...theme.themeColors,
                        textColor: evt.target.value,
                      };

                      this.#emitTheme();
                    }}
                  />
                </div>`
            : nothing}
        </div>
        ${this.themeOptions
          ? html`<div id="theme-options">
              ${map(Object.entries(this.themeOptions), ([id, value]) => {
                const selectedValue =
                  this.themes?.[this.theme ?? ""].templateAdditionalOptions?.[
                    id
                  ];
                return html`<div>
                  <label for=${id}>${value.title}</label
                  ><select
                    name="${id}"
                    @input=${(evt: InputEvent) => {
                      if (!(evt.target instanceof HTMLSelectElement)) {
                        return;
                      }

                      theme.templateAdditionalOptions ??= {};
                      theme.templateAdditionalOptions[id] = evt.target.value;

                      this.#emitTheme();
                    }}
                  >
                    ${map(Object.values(value.values), (item) => {
                      return html`<option
                        ?selected=${selectedValue === item.value}
                        .value=${item.value}
                      >
                        ${item.title}
                      </option>`;
                    })}
                  </select>
                </div>`;
              })}
            </div>`
          : nothing}
      </section>
    </section>`;
  }
}
