/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, LLMContent } from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");
const GlobalStrings = StringsHelper.forSection("Global");

import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  BoardServer,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
} from "@google-labs/breadboard";

import { styles as appPreviewStyles } from "./app-preview.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { UserInput } from "../elements.js";
import { SettingsStore } from "../../data/settings-store.js";
import { classMap } from "lit/directives/class-map.js";
import {
  InputEnterEvent,
  RunEvent,
  StopEvent,
  ThemeApplyEvent,
  ThemeChangeEvent,
} from "../../events/events.js";
import { until } from "lit/directives/until.js";
import {
  AppTheme,
  EdgeLogEntry,
  LogEntry,
  UserInputConfiguration,
} from "../../types/types.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/behaviors.js";
import { ChatState } from "../../state/types.js";
import { styleMap } from "lit/directives/style-map.js";
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
    if (/^#[0-9a-f]{6}$/.test(hexColor)) {
      throw new Error("Invalid color");
    }

    hexColor = hexColor.slice(1);

    const r = Number.parseInt(hexColor.slice(0, 2), 16);
    const g = Number.parseInt(hexColor.slice(2, 4), 16);
    const b = Number.parseInt(hexColor.slice(4, 6), 16);

    const luma = r * 0.299 + g * 0.587 + b * 0.114;

    return luma > 0.5 ? "dark" : "light";
  } catch (err) {
    return "light";
  }
}

@customElement("bb-app-preview")
export class AppPreview extends LitElement {
  @property({ reflect: false })
  accessor graph: GraphDescriptor | null = null;

  /**
   * Provides an up-to-date model of the chat state.
   * See `ChatController` for the implementation that manages the model.
   */
  @property()
  accessor state: ChatState | null = null;

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property({ reflect: false })
  accessor inputsFromLastRun: InspectableRunInputs | null = null;

  @property({ reflect: false })
  accessor events: InspectableRunEvent[] | LogEntry[] | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property({ reflect: true })
  accessor eventPosition = 0;

  @property()
  accessor settings: SettingsStore | null = null;

  @property({ reflect: true })
  accessor showHistory = false;

  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor theme: AppTheme | null = null;

  @state()
  accessor _originalTheme: AppTheme | null = null;

  static styles = appPreviewStyles;

  #newestEntry: Ref<HTMLElement> = createRef();
  #userInputRef: Ref<UserInput> = createRef();
  #renderReady: Promise<void> | null = null;
  #themeStyles: Record<string, string> | null = null;

  #createDefaultTheme(): AppTheme {
    return {
      primaryColor: primaryColor,
      secondaryColor: secondaryColor,
      backgroundColor: backgroundColor,
      textColor: textColor,
      primaryTextColor: primaryTextColor,
    };
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("graph")) {
      if (this.graph?.metadata?.visual?.presentation) {
        this.appTitle =
          this.graph.metadata.visual.presentation.title ??
          this.graph.title ??
          Strings.from("LABEL_UNTITLED_APP");

        this.appDescription =
          this.graph.metadata.visual.presentation.description ??
          this.graph.description ??
          "";

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
        }
      } else {
        this.theme = this.#createDefaultTheme();
      }
    }

    if (changedProperties.has("theme")) {
      this.#themeStyles = this.theme
        ? {
            "--primary-color": this.theme.primaryColor,
            "--secondary-color": this.theme.secondaryColor,
            "--text-color": this.theme.textColor,
            "--primary-text-color": this.theme.primaryTextColor,
            "--background-color": this.theme.backgroundColor,
          }
        : null;

      // Switch the icons over if the theme is darker.
      if (this.theme && this.#themeStyles) {
        if (getThemeModeFromBackground(this.theme.backgroundColor) === "dark") {
          this.#themeStyles["--bb-icon-input"] =
            `var(--bb-icon-input-inverted)`;
          this.#themeStyles["--bb-add-icon-generative-audio"] =
            `var(--bb-add-icon-generative-audio-inverted)`;
          this.#themeStyles["--bb-add-icon-generative-code"] =
            `var(--bb-add-icon-generative-code-inverted)`;
          this.#themeStyles["--bb-add-icon-generative"] =
            `var(--bb-add-icon-generative-inverted)`;
          this.#themeStyles["--bb-add-icon-generative-image"] =
            `var(--bb-add-icon-generative-image-inverted)`;
          this.#themeStyles["--bb-add-icon-generative-text"] =
            `var(--bb-add-icon-generative-text-inverted)`;
          this.#themeStyles["--bb-icon-send-ui"] = `var(--bb-icon-send)`;
          this.#themeStyles["--icon-mic"] = `var(--bb-icon-mic-inverted)`;
          this.#themeStyles["--bb-icon-replay"] =
            `var(--bb-icon-replay-inverted)`;
          this.#themeStyles["--bb-icon-share"] =
            `var(--bb-icon-share-inverted)`;
        } else {
          // TODO.
          this.#themeStyles["--icon-mic"] = `var(--bb-icon-mic)`;
        }
      }
      if (this.theme?.splashScreen) {
        const splashScreen = this.theme.splashScreen;
        if (isStoredData(splashScreen)) {
          // Stored Data splash screen.
          this.#renderReady = Promise.resolve()
            .then(async () => {
              let url = splashScreen.storedData.handle;
              if (url.startsWith(".") && this.graph?.url) {
                url = new URL(url, this.graph?.url).href;
              }

              const response = await fetch(url);
              const data = await response.blob();
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.addEventListener("loadend", () => {
                  resolve(reader.result as string);
                });
                reader.readAsDataURL(data);
              });
            })
            .then((storedBlob) => {
              if (!this.#themeStyles) {
                return;
              }
              this.#themeStyles["--splash-screen"] = `url(${storedBlob})`;
            });
        } else {
          if (!this.#themeStyles) {
            return;
          }

          // Inline Data splash screen.
          const splashScreenData = splashScreen.inlineData;
          this.#themeStyles["--splash-screen"] =
            `url(data:${splashScreenData.mimeType};base64,${splashScreenData.data})`;
        }
      }
    }
  }

  protected updated(): void {
    if (!this.#newestEntry.value) {
      return;
    }

    this.#newestEntry.value.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  async #renderPendingInput(
    event: InspectableRunNodeEvent | EdgeLogEntry | null
  ) {
    let continueRun: (() => void) | null = null;
    let userInputs: UserInputConfiguration[] = [];

    if (event !== null) {
      let descriptor, schema;
      if ("inputs" in event) {
        event satisfies InspectableRunNodeEvent;
        const { inputs, node } = event;
        const nodeSchema = await node.describe(inputs);
        descriptor = node.descriptor;
        schema = nodeSchema?.outputSchema || inputs.schema;
      } else {
        event satisfies EdgeLogEntry;
        descriptor = event.descriptor;
        schema = event.schema;
      }

      if (schema && descriptor) {
        const requiredFields = schema.required ?? [];

        if (!schema.properties || Object.keys(schema.properties).length === 0) {
          this.dispatchEvent(
            new InputEnterEvent(
              descriptor.id,
              {},
              /* allowSavingIfSecret */ true
            )
          );
        }

        // TODO: Implement support for multiple iterations over the
        // same input over a run. Currently, we will only grab the
        // first value.
        const values = this.inputsFromLastRun?.get(descriptor.id)?.[0];
        userInputs = Object.entries(schema.properties ?? {}).reduce(
          (prev, [name, schema]) => {
            let value = values ? values[name] : undefined;
            if (schema.type === "object") {
              if (isLLMContentBehavior(schema)) {
                if (!isLLMContent(value)) {
                  value = undefined;
                }
              } else {
                value = JSON.stringify(value, null, 2);
              }
            }

            if (schema.type === "array") {
              if (isLLMContentArrayBehavior(schema)) {
                if (!isLLMContentArray(value)) {
                  value = undefined;
                }
              } else {
                value = JSON.stringify(value, null, 2);
              }
            }

            if (schema.type === "string" && typeof value === "object") {
              value = undefined;
            }

            prev.push({
              name,
              title: schema.title ?? name,
              secret: false,
              schema,
              configured: false,
              required: requiredFields.includes(name),
              value,
            });

            return prev;
          },
          [] as UserInputConfiguration[]
        );

        continueRun = () => {
          if (!this.#userInputRef.value) {
            return;
          }

          const outputs = this.#userInputRef.value.processData(true);
          if (!outputs) {
            return;
          }

          console.log("OUTPUTS", outputs);
          this.dispatchEvent(
            new InputEnterEvent(
              descriptor.id,
              outputs,
              /* allowSavingIfSecret */ true
            )
          );
        };
      }
    }

    const userInput = html`<bb-user-input
      .boardServers=${this.boardServers}
      .showTypes=${false}
      .showTitleInfo=${false}
      .inputs=${userInputs}
      .inlineControls=${true}
      .llmInputShowEntrySelector=${false}
      .useChatInput=${true}
      .showChatContinueButton=${true}
      .chatAudioWaveColor=${this.theme?.textColor ?? "#ff00ff"}
      ${ref(this.#userInputRef)}
      @bbcontinue=${() => {
        if (!continueRun) {
          return;
        }

        continueRun();
      }}
      @keydown=${(evt: KeyboardEvent) => {
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

        if (!(evt.key === "Enter" && isCtrlCommand)) {
          return;
        }

        if (!continueRun) {
          return;
        }

        continueRun();
      }}
    ></bb-user-input>`;

    return html`${userInput}`;
  }

  #resetTheme() {
    if (!this._originalTheme) {
      return;
    }

    this.theme = this._originalTheme;
    this._originalTheme = null;
  }

  #applyTheme() {
    if (!this.theme) {
      return;
    }

    this.dispatchEvent(
      new ThemeApplyEvent(this.theme, this.appTitle, this.appDescription)
    );
    this._originalTheme = null;
  }

  render() {
    const isPaused = this.state?.status === "paused";
    const isRunning = this.state?.status === "running";
    const isStopped = !this.state || this.state?.status === "stopped";

    const newestEvent = this.events?.at(-1);

    const pendingInput: InspectableRunNodeEvent | EdgeLogEntry | null = (() => {
      if (newestEvent) {
        if (
          newestEvent.type === "node" &&
          "node" in newestEvent &&
          newestEvent.node.descriptor.type === "input"
        ) {
          return newestEvent satisfies InspectableRunNodeEvent;
        }
        if (newestEvent.type === "edge") {
          return newestEvent satisfies EdgeLogEntry;
        }
      }
      return null;
    })();

    const viewContents = html`
      <section
        id="content"
        class=${classMap({ splash: isStopped })}
        style=${this.#themeStyles ? styleMap(this.#themeStyles) : nothing}
        @pointerdown=${() => {
          this.showHistory = false;
        }}
      >
        <div id="controls">
          ${isRunning || isPaused
            ? html`<button
                id="clear"
                @click=${() => {
                  this.dispatchEvent(new StopEvent(true));
                }}
              >
                Clear
              </button>`
            : nothing}
          <button id="share">Share</button>
        </div>
        <div id="log" part="log">
          ${!newestEvent && isStopped
            ? html`<div id="splash">
                <h1>${this.appTitle ?? "Untitled App"}</h1>
                <p>${this.appDescription}</p>
              </div>`
            : html`<bb-chat
                .run=${this.run}
                .events=${this.events}
                .eventPosition=${this.eventPosition}
                .inputsFromLastRun=${this.inputsFromLastRun}
                .showExtendedInfo=${true}
                .settings=${this.settings}
                .showLogTitle=${false}
                .logTitle=${"Run"}
                .boardServers=${this.boardServers}
                .showDebugControls=${false}
                .state=${this.state}
              ></bb-chat>`}
        </div>

        <div
          id="input"
          part="input"
          class=${classMap({
            active: newestEvent !== undefined && !isStopped,
          })}
        >
          ${isRunning || isPaused
            ? until(this.#renderPendingInput(pendingInput))
            : html`<button
                id="run"
                title=${GlobalStrings.from("LABEL_RUN_PROJECT")}
                class=${classMap({ running: isRunning })}
                @click=${() => {
                  if (isRunning) {
                    this.dispatchEvent(new StopEvent());
                  } else {
                    this.dispatchEvent(new RunEvent());
                  }
                }}
              >
                ${isRunning
                  ? GlobalStrings.from("LABEL_STOP")
                  : GlobalStrings.from("LABEL_RUN")}
              </button>`}
        </div>
      </section>
    `;

    // Render as async only when absolutely necessary, which in this case is
    // when there is a splash screen and the app has definitely stopped.
    const renderView =
      this.#renderReady && !newestEvent && isStopped
        ? html`${until(
            this.#renderReady.then(() => viewContents),
            html`<div class="loading">
              ${Strings.from("STATUS_LOADING_APP_PREVIEW")}
            </div>`
          )}`
        : viewContents;

    return html`<div id="container">
      <div id="theme-management">
        <bb-app-theme-creator
          .appTitle=${this.appTitle}
          .appDescription=${this.appDescription}
          .theme=${this.theme}
          @bbthemechange=${(evt: ThemeChangeEvent) => {
            this._originalTheme = this.theme;
            this.theme = evt.theme;
            this.appTitle = evt.appTitle;
            this.appDescription = evt.appDescription;
          }}
          @bbthemeclear=${() => {
            this._originalTheme = this.theme;
            this.theme = this.#createDefaultTheme();
          }}
        ></bb-app-theme-creator>
        ${this._originalTheme
          ? html`<button
              @click=${() => {
                this.#resetTheme();
              }}
            >
              Reset
            </button>`
          : nothing}
        ${this._originalTheme
          ? html`<button
              @click=${() => {
                this.#applyTheme();
              }}
            >
              Apply
            </button>`
          : nothing}
      </div>
      ${renderView}
    </div>`;
  }
}
