/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { type UITheme } from "../../shared/theme/theme.js";
import { themeContext } from "../../shared/contexts/theme.js";

import * as ParticlesUI from "@breadboard-ai/particles-ui";
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
} from "../../../utils/youtube.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../../directives/markdown.js";
import { Field, Orientation } from "@breadboard-ai/particles";

@customElement("ui-basic-segment")
export class UIBasicSegment extends SignalWatcher(LitElement) {
  @property()
  accessor fields: Record<string, Field> | null = null;

  @property()
  accessor values: Record<string, unknown> | null = null;

  @property()
  accessor containerOrientation: Orientation = "vertical";

  @property({ reflect: true, type: Boolean })
  accessor disabled = false;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    ParticlesUI.Styles.all,
    css`
      :host {
        display: block;
      }

      iframe:not([srcdoc]) {
        width: 100%;
        aspect-ratio: 16/9;
      }
    `,
  ];

  #blobUrls: string[] = [];

  disconnectedCallback(): void {
    super.disconnectedCallback();

    for (const url of this.#blobUrls) {
      URL.revokeObjectURL(url);
    }
  }

  #renderField(
    fieldName: string,
    field: Field,
    value: unknown,
    theme: UITheme
  ) {
    switch (field.as) {
      case "image": {
        if (!field.src) {
          return html`Unable to render image - no source provided.`;
        }

        return html`<ui-basic-image
          class=${classMap(theme.components.image)}
          .containerOrientation=${this.containerOrientation}
        >
          <img
            src=${field.src}
            slot="hero"
            class=${classMap(theme.modifiers.cover)}
            alt=${field.title}
          />
          ${field.title && field.modifiers?.includes("hero")
            ? html`<h1
                slot="headline"
                class=${classMap(
                  ParticlesUI.Utils.merge(
                    theme.elements.h1,
                    theme.modifiers.headline,
                    this.containerOrientation === "horizontal"
                      ? theme.elements.h3
                      : {}
                  )
                )}
              >
                ${field.title}
              </h1>`
            : nothing}
        </ui-basic-image>`;
      }

      case "video": {
        if (!field.src) {
          return html`Unable to render video - no source provided.`;
        }

        let uri: string | null = field.src;
        if (isWatchUri(uri) || isShortsUri(uri)) {
          uri = convertWatchOrShortsUriToEmbedUri(uri);
        } else if (isShareUri(uri)) {
          uri = convertShareUriToEmbedUri(uri);
        }

        if (isEmbedUri(uri)) {
          return html`<iframe
            class=${classMap(theme.elements.iframe)}
            src="${uri}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>`;
        } else {
          if (!uri) {
            return html`<p
              class=${classMap(
                ParticlesUI.Utils.merge(theme.elements.p, theme.modifiers.hero)
              )}
            >
              Unable to obtain video.
            </p>`;
          }

          const videoUrl = fetch(uri)
            .then((res) => res.blob())
            .then((blob) => {
              const blobUrl = URL.createObjectURL(blob);
              this.#blobUrls.push(blobUrl);
              return blobUrl;
            });

          return html`<video
            class=${classMap(theme.elements.video)}
            src=${until(videoUrl)}
            controls
          ></video>`;
        }
      }

      case "audio": {
        if (!field.src) {
          return html`Unable to render audio - no source provided.`;
        }

        const audioUrl = fetch(field.src)
          .then((res) => res.blob())
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            this.#blobUrls.push(blobUrl);
            return blobUrl;
          });

        return html`<audio
          class=${classMap(theme.elements.audio)}
          src=${until(audioUrl)}
          controls
        ></audio>`;
      }

      case "file": {
        if (!field.src) {
          return html`Unable to render file - no source provided.`;
        }

        return html`<a
          class=${classMap(
            ParticlesUI.Utils.merge(
              theme.elements.a,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
          href=${field.src}
          >Your file</a
        >`;
      }

      case "googledrive": {
        if (!field.src) {
          return html`Unable to render file - no source provided.`;
        }

        return html`<a
          class=${classMap(
            ParticlesUI.Utils.merge(
              theme.elements.a,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
          href=${`https://drive.google.com/open?id=${field.src}`}
          target="_blank"
          >Google Drive File<span class="g-icon filled round layout-ml-2"
            >open_in_new</span
          ></a
        >`;
      }

      case "pre": {
        if (!field.src) {
          return html`Unable to render content - no source provided.`;
        }

        return html`<pre
          class=${classMap(
            ParticlesUI.Utils.merge(
              theme.elements.pre,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
${value ?? field.src}</pre
        >`;
      }

      case "date":
      case "text": {
        if (field.behaviors?.includes("editable")) {
          return html`<input
            .id=${fieldName}
            .name=${fieldName}
            .value=${value}
            .placeholder=${field.title ?? "Enter a value"}
            ?disabled=${this.disabled}
            type=${field.as}
            class=${classMap(
              ParticlesUI.Utils.merge(
                theme.elements.input,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          />`;
        }

        return html`<section class="layout-w-100">
          ${markdown(
            value as string,
            ParticlesUI.Utils.appendToAll(
              theme.markdown,
              ["ol", "ul", "li"],
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        </section>`;
      }

      case "longtext": {
        if (field.behaviors?.includes("editable")) {
          return html`<textarea
            .id=${fieldName}
            .name=${fieldName}
            .value=${value ?? ""}
            .placeholder=${field.title ?? "Enter a value"}
            ?disabled=${this.disabled}
            class=${classMap(
              ParticlesUI.Utils.merge(
                theme.elements.textarea,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          ></textarea>`;
        }
        return html`<p
          class=${classMap(
            ParticlesUI.Utils.merge(
              theme.elements.p,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
          ${value}
        </p>`;
      }

      case "number": {
        if (field.behaviors?.includes("editable")) {
          return html`<input
            .id=${fieldName}
            .name=${fieldName}
            .value=${value ?? ""}
            .placeholder=${field.title ?? "Enter a value"}
            .type="number"
            ?disabled=${this.disabled}
            class=${classMap(
              ParticlesUI.Utils.merge(
                theme.elements.input,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          />`;
        }
        return html`<p
          class=${classMap(
            ParticlesUI.Utils.merge(
              theme.elements.p,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
          ${value}
        </p>`;
      }

      case "behavior":
        return html`<ui-button
          class=${classMap(theme.elements.button)}
          data-behavior=${fieldName}
          .icon=${field.icon ?? null}
        >
          ${field.title ?? "Action"}
        </ui-button>`;

      default:
        return html`Unknown field`;
    }
  }

  render() {
    if (!this.fields || !this.values || !this.theme) {
      return nothing;
    }

    const values = this.values;
    const theme = this.theme;

    return html` ${repeat(Object.entries(this.fields), ([fieldName, field]) => {
      const value = values[fieldName];
      return this.#renderField(fieldName, field, value, theme);
    })}`;
  }
}
