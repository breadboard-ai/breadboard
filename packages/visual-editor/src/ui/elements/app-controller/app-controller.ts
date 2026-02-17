/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, RuntimeFlags } from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");
const GlobalStrings = StringsHelper.forSection("Global");

import { LitElement, type PropertyValues, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isStoredData } from "@breadboard-ai/utils";

import { styles as appPreviewStyles } from "./app-controller.styles.js";
import {
  AppTemplateOptions,
  AppTheme,
  FloatingInputFocusState,
  STATUS,
} from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { generatePaletteFromColor } from "../../../theme/index.js";
import { loadPartAsDataUrl } from "../../utils/data-parts.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";

import { SignalWatcher } from "@lit-labs/signals";
import { Template } from "../../app-templates/basic/index.js";

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
  @property()
  accessor runtimeFlags: RuntimeFlags | null = null;

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

  @property({ reflect: true })
  accessor status = STATUS.RUNNING;

  @property()
  accessor showGDrive = false;

  @property()
  accessor themeHash: number | null = null;

  @property()
  accessor readOnly = false;

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor headerConfig = {
    replay: true,
    menu: true,
    fullscreen: null,
    small: false,
  };

  @property()
  accessor theme: AppTheme = this.#createDefaultTheme();

  @state()
  accessor _originalTheme: AppTheme | null = null;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = appPreviewStyles;

  #splashBlobUrls = new Map<number, string>();

  @state()
  accessor #appTemplate = new Template();

  @property()
  set isRefreshingAppTheme(refreshing: boolean) {
    if (!this.#appTemplate) {
      return;
    }

    this.#appTemplate.isRefreshingAppTheme = refreshing;
  }
  get isRefreshingAppTheme() {
    if (!this.#appTemplate) {
      return false;
    }

    return this.#appTemplate.isRefreshingAppTheme;
  }

  @property()
  set shouldShowFirstRunMessage(showFirstRunMessage: boolean) {
    if (!this.#appTemplate) {
      return;
    }

    this.#appTemplate.shouldShowFirstRunMessage = showFirstRunMessage;
  }
  get shouldShowFirstRunMessage() {
    if (!this.#appTemplate) {
      return false;
    }

    return this.#appTemplate.showFirstRunMessage;
  }

  @property()
  set firstRunMessage(firstRunMessage: string) {
    if (!this.#appTemplate) {
      return;
    }

    this.#appTemplate.firstRunMessage = firstRunMessage;
  }
  get firstRunMessage() {
    if (!this.#appTemplate) {
      return "";
    }

    return this.#appTemplate.firstRunMessage;
  }

  @property()
  set isFreshGraph(refreshing: boolean) {
    if (!this.#appTemplate) {
      return;
    }

    this.#appTemplate.isFreshGraph = refreshing;
  }
  get isFreshGraph() {
    if (!this.#appTemplate) {
      return false;
    }

    return this.#appTemplate.isFreshGraph;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#clearSplashUrls();
  }

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

  #clearSplashUrls() {
    for (const url of this.#splashBlobUrls.values()) {
      URL.revokeObjectURL(url);
    }

    this.#splashBlobUrls.clear();
  }

  #storeSplashUrl(themeHash: number | null, url: string) {
    if (themeHash === null) {
      console.warn("Theme URL attempted to be stored with no theme hash");
      return;
    }

    this.#splashBlobUrls.set(themeHash, url);
  }

  #getSplashUrl(themeHash: number | null) {
    if (themeHash === null) {
      return null;
    }

    return this.#splashBlobUrls.get(themeHash);
  }

  #retrievingSplashFor = "";
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

    if (this.theme?.splashScreen && !options.isDefaultTheme) {
      options.splashImage = true;

      // Set the options here, then attempt to load the splash screen image.
      this.#appTemplate.options = options;

      const splashScreen = this.theme.splashScreen;
      if (isStoredData(splashScreen)) {
        const themeHash = this.themeHash;

        // Attempt to reuse the splash image.
        const splashImage = this.#getSplashUrl(themeHash);
        if (splashImage) {
          const newSplash = `url(${splashImage})`;
          if (this.#appTemplate.options.splashImage === newSplash) {
            return;
          }

          options.splashImage = `url(${splashImage})`;
          this.#appTemplate.options = { ...options };
          return;
        }

        // Avoid double-requests.
        const requestKey = `${themeHash}|${splashScreen.storedData.handle}`;
        if (this.#retrievingSplashFor === requestKey) {
          return;
        }

        this.#retrievingSplashFor = requestKey;
        // Stored Data splash screen.
        Promise.resolve()
          .then(() =>
            loadPartAsDataUrl(
              this.sca.services.googleDriveClient!,
              splashScreen
            )
          )
          .then((base64DataUrl) => {
            if (!base64DataUrl) return;
            return fetch(base64DataUrl).then((r) => r.blob());
          })
          .then(
            (data?: Blob) => {
              if (!data || !this.#appTemplate) return;

              // A newer theme has arrived - bail.
              if (themeHash !== this.themeHash) return;

              this.#clearSplashUrls();

              const blobUrl = URL.createObjectURL(data);
              this.#storeSplashUrl(this.themeHash, blobUrl);
              options.splashImage = `url(${blobUrl})`;

              this.#appTemplate.options = { ...options };
            },
            (reason: unknown) => {
              console.warn(`Unable to load theme image: ${reason}`);
            }
          )
          .finally(() => {
            this.#retrievingSplashFor = "";
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

  protected willUpdate(changedProperties: PropertyValues<this>): void {
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

          if (
            changedProperties.has("themeHash") &&
            this.themeHash &&
            this.themeHash !== changedProperties.get("themeHash")
          ) {
            this.#retrievingSplashFor = "";
            this.#applyThemeToTemplate();
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
      changedProperties.has("appDescription")
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
      this.#appTemplate.runtimeFlags = this.runtimeFlags;
      this.#appTemplate.headerConfig = this.headerConfig;
    }

    return html`
      <div id="container">
        <div
          id="content"
          class=${classMap({ active: this.#appTemplate !== null })}
        >
          ${this.#appTemplate}
        </div>
      </div>
    `;
  }
}
