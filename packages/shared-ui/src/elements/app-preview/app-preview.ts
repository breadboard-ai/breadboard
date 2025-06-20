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
  BoardServer,
  InspectableRun,
  InspectableRunEvent,
  isInlineData,
  isStoredData,
} from "@google-labs/breadboard";

import { styles as appPreviewStyles } from "./app-preview.styles.js";
import {
  ShareRequestedEvent,
  ThemeEditRequestEvent,
} from "../../events/events.js";
import {
  AppTemplate,
  AppTemplateOptions,
  AppTheme,
  SettingsStore,
  STATUS,
  TopGraphRunResult,
} from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { consume, provide } from "@lit/context";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { generatePaletteFromColor } from "@breadboard-ai/theme";
import { loadPart } from "../../utils/data-parts.js";
import { projectRunContext } from "../../contexts/project-run.js";
import { ProjectRun } from "../../state/types.js";

const primaryColor = "#ffffff";
const secondaryColor = "#7a7a7a";
const backgroundColor = "#ffffff";
const textColor = "#1a1a1a";
const primaryTextColor = "#1a1a1a";

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
  } catch {
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

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property({ reflect: false })
  @provide({ context: projectRunContext })
  accessor projectRun: ProjectRun | null = null;

  @property()
  accessor eventPosition = 0;

  @property()
  accessor isMine = false;

  @property()
  accessor isInSelectionState = false;

  @property()
  accessor showingOlderResult = false;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor theme: AppTheme = this.#createDefaultTheme();

  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor themeHash: string | null = null;

  @property()
  accessor settings: SettingsStore | null = null;

  @state()
  accessor debugEvent: InspectableRunEvent | null = null;

  @property({ reflect: true })
  accessor status = STATUS.RUNNING;

  @state()
  accessor _originalTheme: AppTheme | null = null;

  @consume({ context: googleDriveClientContext })
  accessor googleDriveClient!: GoogleDriveClient | undefined;

  static styles = appPreviewStyles;

  #loadingTemplate = false;
  #appTemplate: AppTemplate | null = null;
  #template = html`<div class="loading">
    <p class="loading-message">Loading...</p>
  </div>`;

  #createDefaultTheme(): AppTheme {
    const palette = generatePaletteFromColor("#f82506");

    return {
      ...palette,
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

  #applyThemeToTemplate() {
    if (!this.#appTemplate) {
      return;
    }

    const options: AppTemplateOptions = {
      mode: "light",
      splashImage: false,
    };

    const templateAdditionalOptionsChosen: Record<string, string> = {};

    let templateAdditionalOptions: Record<string, string> | undefined =
      undefined;
    if (
      this.graph?.metadata?.visual?.presentation?.theme &&
      this.graph?.metadata?.visual?.presentation?.themes
    ) {
      const { themes, theme } = this.graph.metadata.visual.presentation;
      if (themes[theme]) {
        templateAdditionalOptions = themes[theme].templateAdditionalOptions;
        options.isDefaultTheme = themes[theme].isDefaultTheme;
      }
    } else if (
      this.graph?.metadata?.visual?.presentation?.templateAdditionalOptions
    ) {
      templateAdditionalOptions =
        this.graph.metadata.visual.presentation.templateAdditionalOptions;
    }

    if (templateAdditionalOptions) {
      for (const name of Object.keys(this.#appTemplate.additionalOptions)) {
        if (templateAdditionalOptions[name]) {
          templateAdditionalOptionsChosen[name] =
            templateAdditionalOptions[name];
        }
      }
    }

    options.title = this.appTitle;
    options.description = this.appDescription;
    options.mode = getThemeModeFromBackground(this.theme.backgroundColor);
    options.theme = this.theme;
    options.additionalOptions = templateAdditionalOptionsChosen;

    if (this.theme?.splashScreen) {
      options.splashImage = true;

      // Set the options here, then attempt to load the splash screen image.
      this.#appTemplate.options = options;

      const splashScreen = this.theme.splashScreen;
      if (isStoredData(splashScreen)) {
        const themeHash = this.themeHash;

        // Stored Data splash screen.
        Promise.resolve()
          .then(async () => {
            // A newer theme has arrived - bail.
            if (themeHash !== this.themeHash) {
              return;
            }

            return loadPart(this.googleDriveClient!, splashScreen);
          })
          .then((base64DataUrl) => {
            if (!this.#appTemplate) {
              return;
            }

            // A newer theme has arrived - bail.
            if (themeHash !== this.themeHash) {
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

  async #deriveAppURL() {
    if (!this.graph?.url) {
      return;
    }

    for (const server of this.boardServers) {
      const graphUrl = new URL(this.graph.url);
      const capabilities = server.canProvide(graphUrl);
      if (!capabilities) {
        continue;
      }

      if (server.extendedCapabilities().preview) {
        return server.preview(graphUrl);
      }
    }

    return null;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("template")) {
      if (changedProperties.get("template") !== this.template) {
        if (this.#loadingTemplate) {
          return;
        }

        this.#loadingTemplate = true;

        const themeHash = this.themeHash;
        Promise.all([
          this.#loadAppTemplate(this.template),
          this.#deriveAppURL(),
        ]).then(([{ Template }, appURL]) => {
          // A newer theme has arrived - bail.
          if (themeHash !== this.themeHash) {
            return;
          }

          this.#appTemplate = new Template();
          this.#appTemplate.appURL = appURL?.href ?? null;
          this.#template = html`${this.#appTemplate}`;

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

    const setDefaultTheme = () => {
      this.theme = this.#createDefaultTheme();
      this.appTitle = this.graph?.title ?? Strings.from("LABEL_UNTITLED_APP");
      this.appDescription = this.graph?.description ?? "";
    };

    if (changedProperties.has("graph") || changedProperties.has("themeHash")) {
      if (this.graph?.metadata?.visual?.presentation) {
        if (
          this.graph?.metadata?.visual?.presentation?.theme &&
          this.graph?.metadata?.visual?.presentation?.themes
        ) {
          const { themes, theme } = this.graph.metadata.visual.presentation;
          if (themes[theme]) {
            const appPalette =
              themes[theme]?.palette ?? generatePaletteFromColor("#330072");
            const themeColors = themes[theme]?.themeColors ?? {};

            this.template = themes[theme].template ?? "basic";
            this.theme = {
              ...appPalette,
              primaryColor: themeColors?.["primaryColor"] ?? primaryColor,
              secondaryColor: themeColors?.["secondaryColor"] ?? secondaryColor,
              backgroundColor:
                themeColors?.["backgroundColor"] ?? backgroundColor,
              textColor: themeColors?.["textColor"] ?? textColor,
              primaryTextColor:
                themeColors?.["primaryTextColor"] ?? primaryTextColor,
            };

            this.theme.splashScreen = themes[theme].splashScreen;
          } else {
            setDefaultTheme();
          }
        } else if (this.graph.metadata.visual.presentation.template) {
          this.template =
            this.graph.metadata.visual.presentation.template ?? "basic";

          const theme = this.graph.metadata.visual.presentation.themeColors;
          const splashScreen = this.graph.assets?.["@@splash"];

          if (theme) {
            this.theme = {
              ...generatePaletteFromColor("#330072"),
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
          }
        } else {
          setDefaultTheme();
        }
      } else {
        setDefaultTheme();
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

  render() {
    if (this.#appTemplate) {
      this.#appTemplate.graph = this.graph;
      this.#appTemplate.run = this.run;
      this.#appTemplate.topGraphResult = this.topGraphResult;
      this.#appTemplate.eventPosition = this.eventPosition;
      this.#appTemplate.showGDrive = this.showGDrive;
      this.#appTemplate.isInSelectionState = this.isInSelectionState;
      this.#appTemplate.showingOlderResult = this.showingOlderResult;
      this.#appTemplate.readOnly = false;
      this.#appTemplate.showShareButton = false;
      this.#appTemplate.showContentWarning = !this.isMine;
    }

    return html`
      <div id="container">
        <div
          id="content"
          class=${classMap({ active: this.#appTemplate !== null })}
        >
          ${this.#template}
        </div>
        ${this.isMine
          ? html`<div id="theme-edit">
              <button
                id="share-app"
                ?disabled=${this.#loadingTemplate}
                @click=${() => {
                  this.dispatchEvent(new ShareRequestedEvent());
                }}
              >
                <span class="g-icon filled">link</span>Share app
              </button>
              <button
                id="designer"
                ?disabled=${this.#loadingTemplate}
                @click=${() => {
                  this.dispatchEvent(
                    new ThemeEditRequestEvent(
                      this.#appTemplate?.additionalOptions ?? null
                    )
                  );
                }}
              >
                <span class="g-icon filled">palette</span>Edit Theme
              </button>
            </div>`
          : nothing}
      </div>
    `;
  }
}
