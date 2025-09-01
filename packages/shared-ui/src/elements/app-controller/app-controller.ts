/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");
const GlobalStrings = StringsHelper.forSection("Global");

import { LitElement, PropertyValues, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isStoredData } from "@google-labs/breadboard";

import { styles as appPreviewStyles } from "./app-controller.styles.js";
import {
  AppTemplate,
  AppTemplateOptions,
  AppTheme,
  FloatingInputFocusState,
  SettingsStore,
  STATUS,
} from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { consume, provide } from "@lit/context";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { generatePaletteFromColor } from "@breadboard-ai/theme";
import { loadPartAsDataUrl } from "../../utils/data-parts.js";
import { projectRunContext } from "../../contexts/project-run.js";
import { ProjectRun } from "../../state/types.js";
import { SignalWatcher } from "@lit-labs/signals";

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

@customElement("bb-app-controller")
export class AppController extends SignalWatcher(LitElement) {
  @property({ reflect: false })
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor graphIsEmpty = false;

  @property()
  accessor graphTopologyUpdateId = 0;

  @property()
  accessor focusWhenIn: FloatingInputFocusState = ["app"];

  @property()
  accessor isMine = false;

  @property({ reflect: false })
  @provide({ context: projectRunContext })
  accessor projectRun: ProjectRun | null = null;

  @property()
  accessor settings: SettingsStore | null = null;

  @property({ reflect: true })
  accessor status = STATUS.RUNNING;

  @property()
  accessor showGDrive = false;

  @property()
  accessor themeHash: string | null = null;

  @property()
  accessor readOnly = false;

  @property()
  accessor template = "basic";

  @property()
  accessor templates = [{ title: "Basic", value: "basic" }];

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor theme: AppTheme = this.#createDefaultTheme();

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
    const palette = generatePaletteFromColor("#363636");
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

            return loadPartAsDataUrl(this.googleDriveClient!, splashScreen);
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

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("template")) {
      if (changedProperties.get("template") !== this.template) {
        if (this.#loadingTemplate) {
          return;
        }

        this.#loadingTemplate = true;

        const themeHash = this.themeHash;
        this.#loadAppTemplate(this.template).then(({ Template }) => {
          // A newer theme has arrived - bail.
          if (themeHash !== this.themeHash) {
            return;
          }

          this.#appTemplate = new Template();
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
      if (
        this.graph?.metadata?.visual?.presentation &&
        this.graph.metadata.visual.presentation.theme &&
        this.graph.metadata.visual.presentation.themes
      ) {
        const { themes, theme } = this.graph.metadata.visual.presentation;
        if (themes[theme]) {
          const appPalette =
            themes[theme]?.palette ?? generatePaletteFromColor("#363636");
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
      this.#appTemplate.showGDrive = this.showGDrive;
      this.#appTemplate.readOnly = this.readOnly;
      this.#appTemplate.showShareButton = false;
      this.#appTemplate.disclaimerContent = this.isMine
        ? GlobalStrings.from("LABEL_DISCLAIMER")
        : html`This content was created by another person. It may be inaccurate
            or unsafe.
            <a
              target="_blank"
              href="https://support.google.com/legal/answer/3110420?hl=en"
              >Report legal issue</a
            >`;
      this.#appTemplate.isEmpty = this.graphIsEmpty;
      this.#appTemplate.focusWhenIn = this.focusWhenIn;
    }

    return html`
      <div id="container">
        <div
          id="content"
          class=${classMap({ active: this.#appTemplate !== null })}
        >
          ${this.#template}
        </div>
      </div>
    `;
  }
}
