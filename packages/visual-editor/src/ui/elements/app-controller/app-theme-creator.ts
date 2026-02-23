/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Strings from "../../strings/helper.js";
const GlobalStrings = Strings.forSection("Global");

import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "../../../theme/index.js";
import {
  GraphDescriptor,
  GraphTheme,
  InlineDataCapabilityPart,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { until } from "lit/directives/until.js";

import { OverlayDismissedEvent, SnackbarEvent } from "../../events/events.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { AppTemplateAdditionalOptionsAvailable } from "../../types/types.js";
import { AppTheme, SnackType } from "../../../sca/types.js";
import { renderThumbnail } from "../../media/image.js";
import { convertImageToInlineData } from "./image-convert.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

const MAX_UPLOAD_SIZE = 5_242_880; // 5MB.

@customElement("bb-app-theme-creator")
export class AppThemeCreator extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

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

  @state()
  accessor #generating = false;

  @state()
  accessor #generatingRandom = false;

  @state()
  accessor #changed = false;

  #abortController: AbortController | null = null;

  static styles = [
    baseColors,
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
        background: light-dark(var(--n-100), var(--n-15));
        border-radius: var(--bb-grid-size-4);
        height: 100%;
        overflow: auto;

        & > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid light-dark(var(--n-90), var(--n-30));
          height: var(--bb-grid-size-14);
          padding: 0 var(--bb-grid-size-3);

          & h1 {
            flex: 1;
            color: light-dark(var(--n-0), var(--n-80));
          }

          & #close {
            width: 30px;
            height: 30px;
            color: light-dark(var(--n-0), var(--n-80));
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
            color: var(--light-dark-n-60);
          }

          form.generate-container {
            display: flex;
            align-items: center;
            background: var(--light-dark-n-100);
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
              background: var(--light-dark-n-100);
            }

            & #start-generate {
              padding: 0;
              margin: 0;
              color: var(--light-dark-n-0);
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
                color: var(--light-dark-n-0);
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

                &[disabled] {
                  opacity: 0.3;
                  cursor: not-allowed;
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

                .generating-theme,
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

                .generating-theme {
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

            & #actions {
              display: flex;
              gap: var(--bb-grid-size-3);

              & #upload-theme,
              & #random-theme {
                padding: 0;
                margin: var(--bb-grid-size-2) 0;
                border: none;
                height: var(--bb-grid-size-12);
                background: light-dark(
                  var(--ui-custom-o-25),
                  var(--ui-custom-o-30)
                );
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--bb-grid-size-3);
                transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
                flex: 1;
                color: var(--light-dark-n-0);

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
                    background: light-dark(
                      var(--ui-custom-o-20),
                      var(--ui-custom-o-50)
                    );
                  }
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

  async #convertImageToTheme(
    splashScreen: InlineDataCapabilityPart
  ): Promise<AppTheme> {
    try {
      let theme = generatePaletteFromColor("#330072");
      const img = new Image();
      img.src = `data:${splashScreen.inlineData.mimeType};base64,${splashScreen.inlineData.data}`;

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

  async #getImageFile(): Promise<FileList | null> {
    return new Promise((resolve) => {
      const fileSelect = document.createElement("input");
      fileSelect.type = "file";
      fileSelect.accept = "image/*";
      fileSelect.addEventListener("input", () => {
        resolve(fileSelect.files);
      });
      fileSelect.addEventListener("cancel", () => {
        resolve(null);
      });
      fileSelect.click();
    });
  }

  async #handleUploadedThemeImage() {
    try {
      if (this.#generating) {
        return;
      }

      this.#generating = true;
      const images = await this.#getImageFile();
      if (!images) {
        return;
      }

      if (images[0].size > MAX_UPLOAD_SIZE) {
        this.dispatchEvent(
          new SnackbarEvent(
            globalThis.crypto.randomUUID(),
            "This image is too large. Please upload files that are smaller than 5MB",
            SnackType.ERROR,
            [],
            true,
            true
          )
        );
        return;
      }

      try {
        const splashScreen = await convertImageToInlineData(images[0]);
        const appTheme = await this.#convertImageToTheme(splashScreen);
        const adding = await this.sca.actions.theme.add(appTheme);
        if (!ok(adding)) {
          throw new Error(adding.$error);
        }
      } catch (err) {
        this.dispatchEvent(
          new SnackbarEvent(
            globalThis.crypto.randomUUID(),
            String(err),
            SnackType.ERROR,
            [],
            true,
            true
          )
        );
      }
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
    }
  }

  async #debounceGenerateTheme(random = false) {
    try {
      if (this.#generating) {
        return;
      }

      this.#generating = true;
      this.#generatingRandom = random;
      this.#abortController = new AbortController();
      this.sca.controller.global.main.blockingAction = true;
      const newTheme = await this.sca.actions.theme.generate(
        {
          random,
          title: this.graph?.title ?? "Untitled Application",
          description: this.graph?.description,
          userInstruction: this.#generateDescriptionRef.value?.value,
        },
        this.#abortController.signal
      );
      this.sca.controller.global.main.blockingAction = false;
      if (!ok(newTheme)) {
        throw new Error(newTheme.$error);
      }
    } catch (err) {
      console.warn(err);
      let errMessage = "Error";
      if (typeof err === "string") {
        errMessage = err;
      } else if (typeof err === "object") {
        errMessage = (err as Error).message ?? "Unknown error";
      }
      this.#displayError(errMessage);
    } finally {
      this.#generating = false;
      this.#generatingRandom = false;
    }
  }

  #displayError(message: string) {
    this.dispatchEvent(
      new SnackbarEvent(
        globalThis.crypto.randomUUID(),
        message,
        SnackType.ERROR,
        [],
        true,
        true
      )
    );
  }

  async #renderThumbnail(theme: GraphTheme) {
    // For default theme leave this empty so that the default icon will be shown.
    const url = theme.isDefaultTheme
      ? undefined
      : theme.splashScreen?.storedData?.handle;
    // Only show a loading spinner if the theme actually has an image to load.
    // For the default theme (no splash screen), show the fallback icon directly.
    const showLoader = !theme.isDefaultTheme && !!url;
    return await renderThumbnail(
      url,
      this.sca.services.googleDriveClient!,
      {},
      "Theme thumbnail",
      showLoader
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
            this.#abortController?.abort();
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
              @click=${async () => {
                if (!this.theme) {
                  return;
                }

                if (this.sca.controller.editor.theme.status !== "idle") {
                  return;
                }

                this.sca.controller.global.main.blockingAction = true;

                const deleting = await this.sca.actions.theme.deleteTheme(
                  this.theme
                );
                this.sca.controller.global.main.blockingAction = false;

                if (!ok(deleting)) {
                  this.#displayError(deleting.$error);
                }
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
                      if (this.sca.controller.editor.theme.status !== "idle") {
                        return;
                      }

                      this.#changed = true;
                      this.sca.controller.global.main.blockingAction = true;
                      this.sca.actions.theme.setCurrent(id);
                      this.sca.controller.global.main.blockingAction = false;
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
          <div id="actions">
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
                    Working...`
                : html`<span class="g-icon round w-500">casino</span>
                    Randomize`}
            </button>
            <button
              id="upload-theme"
              ?disabled=${this.#changed || this.#generating}
              class="sans-flex round w-500 md-body-small"
              @click=${async (evt: Event) => {
                evt.preventDefault();

                await this.#handleUploadedThemeImage();
              }}
            >
              <span class="g-icon round w-500">upload</span> Upload
            </button>
          </div>
        </section>
      </section>
    </section>`;
  }
}
