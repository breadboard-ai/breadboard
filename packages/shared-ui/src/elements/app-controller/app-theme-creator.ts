/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Strings from "../../strings/helper.js";
const GlobalStrings = Strings.forSection("Global");

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { GraphDescriptor, GraphTheme, LLMContent } from "@breadboard-ai/types";
import GenerateAppTheme from "../../sideboards/sideboards-bgl/generate-app-theme.bgl.json" with { type: "json" };
import {
  AppTemplateAdditionalOptionsAvailable,
  AppTheme,
  SnackType,
} from "../../types/types.js";
import {
  OverlayDismissedEvent,
  SnackbarEvent,
  StateEvent,
} from "../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { sideBoardRuntime } from "../../contexts/side-board-runtime.js";
import { SideBoardRuntime } from "../../sideboards/types.js";
import { classMap } from "lit/directives/class-map.js";
import { isInlineData, isStoredData, ok } from "@google-labs/breadboard";
import { until } from "lit/directives/until.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { renderThumbnail } from "../../utils/image";
import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "@breadboard-ai/theme";
import { guard } from "lit/directives/guard.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { icons } from "../../styles/icons";

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

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient | undefined;

  @state()
  accessor #generating = false;

  @state()
  accessor #generatingRandom = false;

  @state()
  accessor #changed = false;

  static styles = [
    colorsLight,
    type,
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        user-select: none;
      }

      #container {
        display: flex;
        flex-direction: column;
        background: var(--bb-neutral-0);
        border-radius: var(--bb-grid-size-4);
        height: 100%;
        overflow: auto;

        & > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--n-90);
          height: var(--bb-grid-size-14);
          padding: 0 var(--bb-grid-size-3);

          & h1 {
            flex: 1;
          }

          & #close {
            width: 30px;
            height: 30px;
            color: var(--n-0);
            background: none;
            border: none;
            opacity: 0.6;
            transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

            & .g-icon {
              pointer-events: none;
              font-size: 30px;
            }

            &:not([disabled]) {
              cursor: pointer;

              &:hover,
              &:focus {
                opacity: 1;
              }
            }
          }
        }

        & #content {
          flex: 1;
          overflow: scroll;
          scrollbar-width: none;

          #explainer {
            margin: 0;
            padding: var(--bb-grid-size-4) var(--bb-grid-size-3);
            color: var(--n-60);
          }

          form.generate-container {
            display: flex;
            align-items: center;
            background: var(--n-100);
            border-radius: var(--bb-grid-size-3);
            outline: 3px solid var(--ui-custom-o-10);
            padding: var(--bb-grid-size-3);

            &:focus-within {
              outline: 3px solid var(--ui-custom-o-100);
            }

            & textarea {
              border: none;
              padding: var(--bb-grid-size-2);
              field-sizing: content;
              flex: 1;
              outline: none;
              resize: none;
              background: var(--n-100);
            }

            & #start-generate {
              padding: 0;
              margin: 0;
              color: var(--n-0);
              background: none;
              border: none;
              opacity: 0.6;
              transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

              & .g-icon {
                pointer-events: none;
                font-size: 30px;
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  opacity: 1;
                }
              }
            }
          }

          .segment {
            border-radius: var(--bb-grid-size-5);
            padding: var(--bb-grid-size-4);
            background: var(--ui-theme-segment);
            margin: 0 var(--bb-grid-size-3) var(--bb-grid-size-4)
              var(--bb-grid-size-3);

            & h2 {
              flex: 1;
              margin: 0 0 var(--bb-grid-size-5) 0;
            }

            & header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0;
              margin: 0 0 var(--bb-grid-size-5) 0;

              & h2 {
                flex: 1;
                margin: 0;
              }

              & button {
                padding: 0;
                margin: 0;
                color: var(--n-0);
                background: none;
                border: none;
                opacity: 0.6;
                transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

                & .g-icon {
                  pointer-events: none;
                }

                &:not([disabled]) {
                  cursor: pointer;

                  &:hover,
                  &:focus {
                    opacity: 1;
                  }
                }
              }
            }

            & #theme-list {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: var(--bb-grid-size-2);
              margin: 0;
              padding: 0;
              list-style: none;

              & li {
                width: 100%;

                & > .generating-theme,
                & > button {
                  display: block;
                  width: 100%;
                  overflow: hidden;
                  background: none;
                  border: none;
                  border-radius: var(--bb-grid-size-3);
                  aspect-ratio: 1/1;
                  padding: 0;
                  position: relative;

                  & img {
                    object-fit: cover;
                    width: 100%;
                    height: 100%;
                  }

                  &.selected::after {
                    content: "";
                    border-radius: var(--bb-grid-size-3);
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    top: 0;
                    left: 0;
                    box-shadow: inset 0 0 0 3px var(--ui-custom-o-100);
                  }

                  &:not([disabled]) {
                    cursor: pointer;

                    &:hover::after,
                    &:focus::after {
                      content: "";
                      border-radius: var(--bb-grid-size-3);
                      position: absolute;
                      width: 100%;
                      height: 100%;
                      top: 0;
                      left: 0;
                      box-shadow: inset 0 0 0 3px var(--ui-custom-o-100);
                    }
                  }
                }

                & > .generating-theme {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: var(--ui-theme-generating);
                  color: var(--ui-custom-o-100);

                  & .g-icon {
                    animation: rotate 1s linear infinite forwards;
                  }
                }
              }
            }

            & #random-theme {
              padding: 0;
              margin: var(--bb-grid-size-2) 0;
              border: none;
              height: var(--bb-grid-size-12);
              background: var(--ui-custom-o-25);
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: var(--bb-grid-size-3);
              transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
              width: 100%;
              color: var(--n-0);

              & .g-icon {
                pointer-events: none;
                margin-right: var(--bb-grid-size-2);

                &.rotate {
                  animation: rotate 1s linear infinite forwards;
                }
              }

              &[disabled] {
                opacity: 1;
              }

              &:not([disabled]) {
                cursor: pointer;

                &:hover,
                &:focus {
                  background: var(--ui-custom-o-20);
                }
              }
            }
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  #selectedThemeRef: Ref<HTMLButtonElement> = createRef();
  #generateDescriptionRef: Ref<HTMLTextAreaElement> = createRef();
  #containerRef: Ref<HTMLDivElement> = createRef();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("graph") || changedProperties.has("themeHash")) {
      if (this.graph) {
        this.theme = this.graph.metadata?.visual?.presentation?.theme ?? null;
        this.themes = {
          ...(this.graph.metadata?.visual?.presentation?.themes ?? null),
        };
      }
    }

    this.#changed = false;
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
    const context: LLMContent[] = [
      {
        role: "user",
        parts: [
          {
            text: `ULTRA IMPORTANT: The application's name is: "${appName}".`,
          },
        ],
      },
    ];

    if (appDescription) {
      context[0].parts.push({
        text: `The app does the following: "${appDescription}"`,
      });
    }

    if (additionalInformation) {
      context[0].parts.push({ text: additionalInformation });
    }

    const result = await this.sideBoardRuntime.runTask({
      graph: GenerateAppTheme as GraphDescriptor,
      url: this.graph?.url,
      context,
    });
    if (!ok(result)) {
      throw new Error(result.$error);
    }

    const [response] = result;

    // The splash image.
    const [splashScreen] = response.parts;

    if (!(isInlineData(splashScreen) || isStoredData(splashScreen))) {
      throw new Error("Invalid model response");
    }

    try {
      let theme = generatePaletteFromColor("#330072");
      const img = new Image();
      if (isInlineData(splashScreen)) {
        img.src = `data:${splashScreen.inlineData.mimeType};base64,${splashScreen.inlineData.data}`;
      } else {
        img.src = splashScreen.storedData.handle;
        img.crossOrigin = "anonymous";
      }
      const generatedTheme = await generatePaletteFromImage(img);
      if (generatedTheme) {
        theme = generatedTheme;
      }

      return {
        ...theme,
        primaryColor: "",
        secondaryColor: "",
        textColor: "",
        tertiary: "",
        primaryTextColor: "",
        backgroundColor: "",
        splashScreen,
      };
    } catch (err) {
      console.warn(err);
      throw new Error("Invalid color scheme generated");
    }
  }

  async #debounceGenerateTheme(random = false) {
    try {
      if (this.#generating) {
        return;
      }

      this.#generating = true;
      this.#generatingRandom = random;
      const newTheme = await this.#generateTheme(
        random
          ? "Random application"
          : (this.graph?.title ?? "Untitled Application"),
        random
          ? "No description provided"
          : (this.graph?.description ?? undefined),
        random
          ? "Generate me a fun image of your choosing about anything you like"
          : this.#generateDescriptionRef.value?.value
      );
      this.dispatchEvent(
        new StateEvent({ eventType: "theme.create", theme: newTheme })
      );
    } catch (err) {
      console.warn(err);
      let errMessage = "Error";
      if (typeof err === "string") {
        errMessage = err;
      } else if (typeof err === "object") {
        errMessage = (err as Error).message ?? "Unknown error";
      }
      this.dispatchEvent(
        new SnackbarEvent(
          globalThis.crypto.randomUUID(),
          errMessage,
          SnackType.ERROR,
          [],
          true,
          true
        )
      );
    } finally {
      this.#generating = false;
      this.#generatingRandom = false;
    }
  }

  async #renderThumbnail(theme: GraphTheme) {
    // For default theme leave this empty so that the default icon will be shown.
    const url = theme.isDefaultTheme
      ? undefined
      : theme.splashScreen?.storedData?.handle;
    return await renderThumbnail(
      url,
      this.googleDriveClient!,
      {},
      "Theme thumbnail"
    );
  }

  render() {
    if (!this.themes || !this.theme) {
      console.log("No themes found");
      return nothing;
    }

    return html`<section
      id="container"
      ${ref(this.#containerRef)}
      ?inert=${this.#generating}
    >
      <header>
        <h1 class="sans-flex round w-500 md-title-medium">Theme editor</h1>
        <button
          id="close"
          @click=${() => {
            this.dispatchEvent(new OverlayDismissedEvent());
          }}
        >
          <span class="g-icon round filled w-500">close</span>
        </button>
      </header>
      <section id="content">
        <p id="explainer" class="san-flex w-400 md-body-small">
          Generate a theme for your Opal app below. You can either provide a
          description of the theme you would like, or you can generate a random
          theme.
        </p>
        <section class="segment" id="generate-theme">
          <h2 class="sans-flex round w-500 md-title-medium">
            Generate your own theme
          </h2>
          <form
            class="generate-container"
            @submit=${(evt: SubmitEvent) => {
              evt.preventDefault();
            }}
          >
            <textarea
              autocomplete="off"
              placeholder="e.g. Sci-fi claymation cats"
              class="sans-flex round w-500 md-title-medium"
              ${ref(this.#generateDescriptionRef)}
              @keydown=${async (evt: KeyboardEvent) => {
                if (!(evt.key === "Enter")) {
                  return;
                }
                await this.#debounceGenerateTheme();
              }}
              ?disabled=${this.#changed || this.#generating}
            ></textarea>

            <button
              id="start-generate"
              ?disabled=${this.#changed || this.#generating}
              @click=${async (evt: Event) => {
                evt.preventDefault();

                await this.#debounceGenerateTheme();
              }}
            >
              <span class="g-icon filled round">pen_spark</span>
            </button>
          </form>
        </section>
        <section class="segment" id="theme-selector">
          <header>
            <h2 class="sans-flex round w-500 md-title-medium">
              Themes for your ${GlobalStrings.from("APP_NAME")} app
            </h2>
            <button
              ?disabled=${Object.keys(this.themes).length === 1}
              @click=${() => {
                if (!this.theme) {
                  return;
                }

                this.dispatchEvent(
                  new StateEvent({ eventType: "theme.delete", id: this.theme })
                );
              }}
            >
              <span class="g-icon round filled">delete</span>
            </button>
          </header>

          <menu id="theme-list">
            ${repeat(
              Object.entries(this.themes),
              ([id]) => id,
              ([id, theme]) => {
                let url = theme.splashScreen?.storedData.handle;
                if (url && url.startsWith(".") && this.graph?.url) {
                  url = new URL(url, this.graph?.url).href;
                }

                return html`<li>
                  <button
                    ?disabled=${this.#changed ||
                    this.#generating ||
                    id === this.theme}
                    class=${classMap({ selected: id === this.theme })}
                    ${this.theme === id ? ref(this.#selectedThemeRef) : nothing}
                    @click=${() => {
                      this.#changed = true;
                      this.dispatchEvent(
                        new StateEvent({ eventType: "theme.change", id })
                      );
                    }}
                  >
                    ${guard(
                      [theme.splashScreen],
                      () => html`${until(this.#renderThumbnail(theme))}`
                    )}
                  </button>
                </li>`;
              }
            )}
            ${this.#generating
              ? html`<li>
                  <div class="generating-theme">
                    <span class="g-icon round filled w-500"
                      >progress_activity</span
                    >
                  </div>
                </li>`
              : nothing}
          </menu>
          <button
            id="random-theme"
            ?disabled=${this.#changed || this.#generating}
            class="sans-flex round w-500 md-body-small"
            @click=${async (evt: Event) => {
              evt.preventDefault();

              await this.#debounceGenerateTheme(true);
            }}
          >
            ${this.#generatingRandom
              ? html`<span class="g-icon filled round rotate"
                    >progress_activity</span
                  >
                  Generating theme...`
              : html`<span class="g-icon round w-500">casino</span> Generate a
                  random theme`}
          </button>
        </section>
      </section>
    </section>`;
  }
}
