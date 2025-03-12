/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, LLMContent } from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");

import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  InspectableRun,
  isInlineData,
  isStoredData,
} from "@google-labs/breadboard";

import { styles as appPreviewStyles } from "./app-preview.styles.js";
import { ThemeApplyEvent, ThemeChangeEvent } from "../../events/events.js";
import {
  AppTemplate,
  AppTemplateOptions,
  AppTheme,
  TopGraphRunResult,
} from "../../types/types.js";
import { getGlobalColor } from "../../utils/color.js";

const primaryColor = getGlobalColor("--bb-ui-700");
const secondaryColor = getGlobalColor("--bb-ui-400");
const backgroundColor = getGlobalColor("--bb-neutral-0");
const textColor = getGlobalColor("--bb-neutral-900");
const primaryTextColor = getGlobalColor("--bb-neutral-0");

/**
 * Based on https://www.w3.org/TR/AERT/#color-contrast
 *
 * @param hexColor
 * @returns
 */
function getThemeModeFromBackground(hexColor: string): "light" | "dark" {
  try {
    if (!/^#[0-9a-f]{6}$/.test(hexColor.toLowerCase())) {
      throw new Error("Invalid color");
    }

    hexColor = hexColor.slice(1);

    const r = Number.parseInt(hexColor.slice(0, 2), 16);
    const g = Number.parseInt(hexColor.slice(2, 4), 16);
    const b = Number.parseInt(hexColor.slice(4, 6), 16);

    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    return luma > 128 ? "light" : "dark";
  } catch (err) {
    return "light";
  }
}

@customElement("bb-app-preview")
export class AppPreview extends LitElement {
  @property({ reflect: false })
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor showGDrive = false;

  @property()
  accessor template = "basic";

  @property()
  accessor templates = [{ title: "Basic", value: "basic" }];

  @property()
  accessor templateAdditionalOptionsChosen: Record<string, string> = {};

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property()
  accessor eventPosition = 0;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor theme: AppTheme = this.#createDefaultTheme();

  @state()
  accessor _originalTheme: AppTheme | null = null;

  static styles = appPreviewStyles;

  #loadingTemplate = false;
  #appTemplate: AppTemplate | null = null;
  #template = html`<div class="loading">
    <p class="loading-message">Loading...</p>
  </div>`;

  #createDefaultTheme(): AppTheme {
    return {
      primaryColor: primaryColor,
      secondaryColor: secondaryColor,
      backgroundColor: backgroundColor,
      textColor: textColor,
      primaryTextColor: primaryTextColor,
      splashScreen: {
        storedData: {
          handle: "/images/app/generic-flow.jpg",
          mimeType: "image/jpeg",
        },
      },
    };
  }

  #splashImage = new Map<string, string>();
  #applyThemeToTemplate() {
    if (!this.#appTemplate) {
      return;
    }

    const options: AppTemplateOptions = {
      mode: "light",
      splashImage: false,
    };

    options.title = this.appTitle;
    options.description = this.appDescription;
    options.mode = getThemeModeFromBackground(this.theme.backgroundColor);
    options.theme = this.theme;
    options.additionalOptions = this.templateAdditionalOptionsChosen;

    if (this.theme?.splashScreen) {
      options.splashImage = true;

      // Set the options here, then attempt to load the splash screen image.
      this.#appTemplate.options = options;

      const splashScreen = this.theme.splashScreen;
      if (isStoredData(splashScreen)) {
        // Stored Data splash screen.
        Promise.resolve()
          .then(async () => {
            let url = splashScreen.storedData.handle;
            if (url.startsWith(".") && this.graph?.url) {
              url = new URL(url, this.graph?.url).href;
            }

            const cachedSplashImage = this.#splashImage.get(url);
            if (cachedSplashImage) {
              return cachedSplashImage;
            } else {
              this.#splashImage.clear();

              const response = await fetch(url);
              const data = await response.blob();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.addEventListener("loadend", () => {
                  const result = reader.result as string;
                  this.#splashImage.set(url, result);
                  resolve(result);
                });
                reader.readAsDataURL(data);
              });
            }
          })
          .then((base64DataUrl) => {
            if (!this.#appTemplate) {
              return;
            }
            options.splashImage = `url(${base64DataUrl})`;
            this.#appTemplate.options = { ...options };
          });
      } else {
        // Inline Data splash screen.
        const splashScreenData = splashScreen.inlineData;
        options.splashImage = `url(data:${splashScreenData.mimeType};base64,${splashScreenData.data})`;
        this.#appTemplate.options = { ...options };
      }
    } else {
      options.splashImage = false;
      this.#appTemplate.options = options;
    }
  }

  #loadAppTemplate(theme: string) {
    switch (theme) {
      case "basic":
        return import("../../app-templates/basic/index.js");

      default:
        throw new Error(`Unknown theme: ${theme}`);
    }
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("template")) {
      if (changedProperties.get("template") !== this.template) {
        if (this.#loadingTemplate) {
          return;
        }

        this.#loadingTemplate = true;

        this.#loadAppTemplate(this.template).then(({ Template }) => {
          this.#appTemplate = new Template();
          this.#template = html`${this.#appTemplate}`;

          if (
            this.graph?.metadata?.visual?.presentation
              ?.templateAdditionalOptions
          ) {
            const templateAdditionalOptions =
              this.graph.metadata.visual.presentation.templateAdditionalOptions;
            const templateAdditionalOptionsChosen: Record<string, string> = {};

            for (const name of Object.keys(
              this.#appTemplate.additionalOptions
            )) {
              if (templateAdditionalOptions[name]) {
                templateAdditionalOptionsChosen[name] =
                  templateAdditionalOptions[name];
              }
            }

            this.templateAdditionalOptionsChosen =
              templateAdditionalOptionsChosen;
          }

          this.#applyThemeToTemplate();
          this.#loadingTemplate = false;

          requestAnimationFrame(() => {
            this.requestUpdate();
          });
        });
      }
    }

    if (this.graph) {
      if (this.graph.title !== this.appTitle) {
        this.appTitle = this.graph.title ?? Strings.from("LABEL_UNTITLED_APP");
      }

      if (this.graph.description !== this.appDescription) {
        this.appDescription = this.graph.description ?? "";
      }
    }

    if (changedProperties.has("graph")) {
      if (this.graph?.metadata?.visual?.presentation) {
        this.template =
          this.graph.metadata.visual.presentation.template ?? "basic";

        const theme = this.graph.metadata.visual.presentation.themeColors;
        const splashScreen = this.graph.assets?.["@@splash"];

        if (theme) {
          this.theme = {
            primaryColor: theme["primaryColor"] ?? primaryColor,
            secondaryColor: theme["secondaryColor"] ?? secondaryColor,
            backgroundColor: theme["backgroundColor"] ?? backgroundColor,
            textColor: theme["textColor"] ?? textColor,
            primaryTextColor: theme["primaryTextColor"] ?? primaryTextColor,
          };

          if (splashScreen) {
            const splashScreenData = splashScreen.data as LLMContent[];
            if (splashScreenData.length && splashScreenData[0].parts.length) {
              const splash = splashScreenData[0].parts[0];
              if (isInlineData(splash) || isStoredData(splash)) {
                this.theme.splashScreen = splash;
              }
            }
          }
        } else {
          this.theme = this.#createDefaultTheme();
          this.appTitle =
            this.graph.title ?? Strings.from("LABEL_UNTITLED_APP");
          this.appDescription = this.graph?.description ?? "";
        }
      } else {
        this.theme = this.#createDefaultTheme();
        this.appTitle = this.graph?.title ?? Strings.from("LABEL_UNTITLED_APP");
        this.appDescription = this.graph?.description ?? "";
      }

      this.#applyThemeToTemplate();
    }

    if (
      changedProperties.has("theme") ||
      changedProperties.has("appTitle") ||
      changedProperties.has("appDescription") ||
      changedProperties.has("template") ||
      changedProperties.has("templateAdditionalOptionsChosen")
    ) {
      this.#applyThemeToTemplate();
    }
  }

  #resetTheme() {
    if (!this._originalTheme) {
      return;
    }

    this.templateAdditionalOptionsChosen = {};
    this.theme = this._originalTheme;
    this._originalTheme = null;
  }

  #applyTheme() {
    if (!this.theme) {
      return;
    }

    this.dispatchEvent(
      new ThemeApplyEvent(
        this.theme,
        this.appTitle,
        this.appDescription,
        this.template,
        this.templateAdditionalOptionsChosen
      )
    );
    this._originalTheme = null;
  }

  render() {
    if (this.#appTemplate) {
      this.#appTemplate.graph = this.graph;
      this.#appTemplate.run = this.run;
      this.#appTemplate.topGraphResult = this.topGraphResult;
      this.#appTemplate.eventPosition = this.eventPosition;
      this.#appTemplate.showGDrive = this.showGDrive;
    }

    return html`<div id="container">
      <div id="theme-management">
        <bb-app-theme-creator
          .graph=${this.graph}
          .appTitle=${this.appTitle}
          .appDescription=${this.appDescription}
          .theme=${this.theme}
          .template=${this.template}
          .templates=${this.templates}
          .additionalOptions=${this.#appTemplate?.additionalOptions ?? null}
          .templateAdditionalOptionsChosen=${this
            .templateAdditionalOptionsChosen}
          @bbthemechange=${(evt: ThemeChangeEvent) => {
            if (!this._originalTheme) {
              this._originalTheme = this.theme;
            }
            this.theme = evt.theme;
            this.appTitle = evt.appTitle;
            this.appDescription = evt.appDescription;
            if (evt.template) {
              this.template = evt.template;
            }
            this.templateAdditionalOptionsChosen = evt.templateOptionsChosen;
          }}
          @bbthemeclear=${() => {
            if (!this._originalTheme) {
              this._originalTheme = this.theme;
            }

            this.templateAdditionalOptionsChosen = {};
            this.theme = this.#createDefaultTheme();
          }}
        ></bb-app-theme-creator>

        ${this._originalTheme
          ? html`<div id="controls">
              <button
                @click=${() => {
                  this.#applyTheme();
                }}
              >
                Save theme
              </button>
              <button
                id="revert"
                @click=${() => {
                  this.#resetTheme();
                }}
              >
                Revert to saved
              </button>
            </div>`
          : nothing}
      </div>
      <div id="content">${this.#template}</div>
    </div>`;
  }
}
