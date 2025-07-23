/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  Field,
  FieldName,
  Orientation,
  ParticleData,
} from "@breadboard-ai/particles";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { themeContext } from "../../context/theme.js";
import { ParticleViewer, UITheme } from "../../types/types.js";
import * as Styles from "../../styles/index.js";
import { merge } from "../../utils/utils.js";

@customElement("particle-viewer-image")
export class ParticleViewerImage extends LitElement implements ParticleViewer {
  @property({ reflect: true, type: String })
  accessor containerOrientation: Orientation | null = null;

  @property({ attribute: true, type: String })
  accessor value: ParticleData | null = null;

  @property()
  accessor fieldName: FieldName | null = null;

  @property()
  accessor field: Field | null = null;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    Styles.all,
    css`
      :host {
        display: block;
        overflow: hidden;
      }

      section {
        display: grid;
        height: 100%;
        position: relative;
      }

      button > * {
        pointer-events: none;
      }

      span.fade {
        animation: fade 1s cubic-bezier(0.5, 0, 0.3, 1) 0.75s forwards;
      }

      @keyframes fade {
        from {
          opacity: 1;
        }

        to {
          opacity: 0;
        }
      }
    `,
  ];

  #download() {
    if (typeof this.value !== "string") {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = this.value;
    anchor.download = this.field?.title ?? "Download";
    anchor.click();
  }

  /**
   * In order to work with Chrome we have to ensure we have a PNG, so what we
   * have to do is load the image, pop it in a canvas and get a Blob back from
   * it to populate the clipboard successfully. That way, even if we get a JPEG
   * we can convert it over to PNG.
   */
  async #copyToClipboard() {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      if (typeof this.value !== "string") {
        reject("Value not string");
        return;
      }

      const innerImage = new Image();
      innerImage.src = this.value;
      innerImage.onload = () => resolve(innerImage);
      innerImage.onerror = () => reject("Unable to load image");
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create canvas context");
    }

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const clipboardData = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject("Failed to create blob");
      }, "image/png");
    });

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": clipboardData,
      }),
    ]);
  }

  #swapTimeout = 0;
  render() {
    if (!this.value || !this.field || !this.theme) {
      return nothing;
    }

    return html`<section class="layout-pos-rel">
      <img
        src=${this.value}
        class=${classMap(this.theme.modifiers.cover)}
        alt=${this.field.title}
      />
      ${this.field.behaviors?.includes("clone")
        ? html` <button
            id="clone"
            class=${classMap(this.theme.behaviors.clone)}
            @click=${async (evt: Event) => {
              const span = (
                evt.target as HTMLElement
              ).querySelector<HTMLElement>("span");
              if (span) {
                span.textContent = "check";
                span.classList.add("fade");
                // This is in lieu of having particle-driven toasts/snackbars.
                // Instead we swap the icon to at least provide a little feedback.
                // TODO: Replace with particle-based feedback.
                clearTimeout(this.#swapTimeout);
                this.#swapTimeout = window.setTimeout(() => {
                  span.textContent = "content_copy";
                  span.classList.remove("fade");
                }, 2_000);
              }
              await this.#copyToClipboard();
            }}
          >
            <span class=${classMap(this.theme.extras.icon)}>content_copy</span>
          </button>`
        : nothing}
      ${this.field.behaviors?.includes("download")
        ? html` <button
            id="download"
            class=${classMap(this.theme.behaviors.download)}
            @click=${() => this.#download()}
          >
            <span class=${classMap(this.theme.extras.icon)}>download</span>
          </button>`
        : nothing}
      ${this.field.title && this.field.modifiers?.includes("hero")
        ? html`<h1
            slot="headline"
            class=${classMap(
              merge(
                this.theme.elements.h1,
                this.theme.modifiers.headline,
                this.containerOrientation === "horizontal"
                  ? this.theme.elements.h3
                  : {}
              )
            )}
          >
            ${this.field.title}
          </h1>`
        : nothing}
    </section>`;
  }
}
