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
import { AppTheme, AppThemeColors } from "../../types/types.js";
import { ThemeChangeEvent, ThemeClearEvent } from "../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";

@customElement("bb-app-theme-creator")
export class AppThemeCreator extends LitElement {
  @property()
  accessor appTitle: string | null = null;

  @property()
  accessor appDescription: string | null = null;

  @property()
  accessor theme: AppTheme | null = null;

  @consume({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime | undefined;

  @state()
  accessor _generating = false;

  @state()
  accessor _changed = false;

  static styles = css`
    :host {
      display: block;
    }

    #container {
      display: flex;
      flex-direction: column;
      padding: var(--bb-grid-size-3);
    }
  `;

  #generateDescriptionRef: Ref<HTMLTextAreaElement> = createRef();

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
      changedProperties.has("theme")
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
    const runner = await this.sideBoardRuntime.createRunner({
      ...(GenerateAppTheme as GraphDescriptor),
    });
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

  render() {
    return html`<section id="container">
      ${this.theme
        ? html`<section>
            <div>
              <label for="primary">Primary</label>
              <input
                id="primary"
                type="color"
                disabled
                .value=${this.theme.primaryColor}
              />
            </div>
            <div>
              <label for="secondary">Secondary</label>
              <input
                id="secondary"
                type="color"
                disabled
                .value=${this.theme.secondaryColor}
              />
            </div>
            <div>
              <label for="background">Background</label>
              <input
                id="background"
                type="color"
                disabled
                .value=${this.theme.backgroundColor}
              />
            </div>
            <div>
              <label for="primary-text">Primary Text</label>
              <input
                id="primary-text"
                type="color"
                disabled
                .value=${this.theme.primaryTextColor}
              />
            </div>
            <div>
              <label for="text">Text</label>
              <input
                id="text"
                type="color"
                disabled
                .value=${this.theme.textColor}
              />
            </div>
          </section>`
        : nothing}
      <input
        type="text"
        .value=${this.appTitle}
        ?disabled=${this._generating}
        @input=${(evt: InputEvent) => {
          if (!(evt.target instanceof HTMLInputElement)) {
            return;
          }

          this.appTitle = evt.target.value ?? "Untitled Application";
        }}
      />
      <textarea
        placeholder="Describe your app"
        .value=${this.appDescription}
        ?disabled=${this._generating}
        @input=${(evt: InputEvent) => {
          if (!(evt.target instanceof HTMLTextAreaElement)) {
            return;
          }

          this.appDescription = evt.target.value ?? "";
        }}
      ></textarea>
      <textarea
        placeholder="Describe your theme"
        ${ref(this.#generateDescriptionRef)}
        ?disabled=${this._generating}
      ></textarea>
      <button
        ?disabled=${this._generating}
        @click=${async () => {
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
        }}
      >
        Generate
      </button>

      <button
        ?disabled=${!this._changed}
        @click=${() => {
          if (!this.theme) {
            return;
          }

          this._changed = false;
          this.dispatchEvent(
            new ThemeChangeEvent(this.theme, this.appTitle, this.appDescription)
          );
        }}
      >
        Update theme
      </button>
      <button
        @click=${() => {
          if (!this.theme) {
            return;
          }

          this._changed = false;
          this.dispatchEvent(new ThemeClearEvent());
        }}
      >
        Clear
      </button>
    </section>`;
  }
}
