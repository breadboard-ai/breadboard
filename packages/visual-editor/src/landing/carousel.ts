/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { galleryItems } from "./gallery-items.js";
import { fonts } from "./fonts.js";

import "./carousel-modal.js";
import { shortestPath, toCSSMatrix } from "./utils.js";
import { makeUrl } from "../ui/navigation/urls.js";

@customElement("landing-carousel")
export class LandingCarousel extends LitElement {
  @property()
  accessor appName = "";

  static styles = [
    fonts,
    css`
      :host {
        display: block;
        width: 100%;
        aspect-ratio: 2;
        min-height: 390px;
        max-height: 600px;
        position: relative;
        user-select: none;
      }

      .container {
        position: relative;
        height: 100%;
        width: 100%;
        container-type: inline-size;
        max-height: 600px;
        min-height: 390px;
      }

      .card {
        width: 15cqw;
        min-width: 100px;
        max-width: 140px;
        padding-top: clamp(140px, 20%, 195px);
        position: absolute;
        left: 50%;
        top: 150%;
        translate: -50% 0;
        transition:
          padding-top 0.6s cubic-bezier(0.5, 0, 0.3, 1),
          transform 0.6s cubic-bezier(0.5, 0, 0.3, 1);
        transform-origin: 50% 50%;
        cursor: pointer;

        & .inner {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background: gray;
          transition: scale 0.3s cubic-bezier(0.5, 0, 0.3, 1);
          box-sizing: border-box;
          padding: 4px;
          position: absolute;
          top: 0;
          left: 0;

          & img {
            border-radius: 8px;
            width: 100%;
            margin-bottom: max(8px, 0.8cqw);
          }

          & section {
            display: flex;
            flex-direction: column;
            gap: 0.2cqw;

            & h1 {
              transition: transform 0.1s cubic-bezier(0.5, 0, 0.3, 1);
              font-size: clamp(9px, 1cqw, 13px);
              width: 90%;
              text-align: center;
              margin: 0 auto;
              line-height: 1.1;
            }

            & p {
              transition:
                opacity 0.1s cubic-bezier(0.5, 0, 0.3, 1),
                transform 0.1s cubic-bezier(0.5, 0, 0.3, 1);
              opacity: 0;
              text-align: center;
              font-size: clamp(7px, 1cqw, 9px);
              margin: 0 auto;
              width: 90%;
              line-height: 1.4;
              font-weight: 500;
              font-variation-settings:
                "wdth" 100,
                "GRAD" 0,
                "ROND" 100,
                "slnt" 0;
            }
          }
        }

        &.current {
          padding-top: clamp(170px, 25%, 245px);

          & .inner {
            scale: 1.4;

            & h1 {
              transform: translateY(max(3px, 0.3cqw));
            }

            & p {
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1) 0.2s;
              transform: translateY(max(5px, 0.9cqw));
              opacity: 1;
            }
          }
        }
      }

      .try-app {
        display: flex;
        align-items: center;
        border: none;
        font-size: 16px;
        height: 56px;
        padding: 0 var(--bb-grid-size-6);
        white-space: nowrap;
        cursor: pointer;
        text-decoration: none;
        background: var(--n-0);
        color: var(--n-100);
        border-radius: var(--bb-grid-size-16);
        gap: var(--bb-grid-size-2);

        &.sticky {
          position: absolute;
          bottom: 10%;
          left: 50%;
          translate: -50% 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;

          & .inner {
            transition: none;
          }
        }
      }
    `,
  ];

  @state()
  accessor dimensions = new DOMRect();

  @state()
  accessor currentItem = 0;

  @state()
  accessor showingModal = false;
  #modalItem = 0;

  @state()
  accessor visible = true;

  #onVisibilityChangeBound = this.#onVisibilityChange.bind(this);
  #resizeObserver = new ResizeObserver((entries) => {
    const [entry] = entries;
    this.dimensions = entry.contentRect;
  });

  #onVisibilityChange() {
    this.visible = document.visibilityState !== "hidden";
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);

    document.addEventListener(
      "visibilitychange",
      this.#onVisibilityChangeBound
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
    this.#cancelAnimation();

    document.removeEventListener(
      "visibilitychange",
      this.#onVisibilityChangeBound
    );
  }

  protected firstUpdated(): void {
    this.#maybeScheduleAnimation();
  }

  #nextAnimation = 0;
  #maybeScheduleAnimation() {
    if (this.showingModal || !this.visible) {
      return;
    }

    this.currentItem++;
    this.currentItem %= galleryItems.length;

    this.#cancelAnimation();
    this.#nextAnimation = window.setTimeout(
      () => this.#maybeScheduleAnimation(),
      3_000
    );
  }

  #cancelAnimation() {
    window.clearTimeout(this.#nextAnimation);
  }

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("showingModal") && !this.showingModal) {
      this.#maybeScheduleAnimation();
    }

    if (changedProperties.has("visible")) {
      if (this.visible) {
        this.#maybeScheduleAnimation();
      } else {
        this.#cancelAnimation();
      }
    }
  }

  #renderCarousel() {
    return html`<div class="container">
      ${repeat(galleryItems, (val, idx) => {
        const matrix = new DOMMatrix();
        const circularIdx = shortestPath(
          this.currentItem,
          idx,
          galleryItems.length
        );

        matrix.rotateSelf(0, 0, circularIdx * 18);
        matrix.translateSelf(0, -this.dimensions.height * 1.4);

        return html`<div
          class=${classMap({ card: true, current: idx === this.currentItem })}
          style=${styleMap({ transform: toCSSMatrix(matrix, true) })}
        >
          <div
            class="inner"
            style=${styleMap({ backgroundColor: val.bgCol, color: val.txtCol })}
            @click=${() => {
              this.#modalItem = idx;
              this.showingModal = true;
            }}
          >
            <img src=${val.carouselImg} />
            <section>
              <h1 class="sans-flex round w-500">${val.title}</h1>
              <p>${val.description}</p>
            </section>
          </div>
        </div>`;
      })}

      <a
        class="try-app sticky"
        .href=${makeUrl({
          page: "graph",
          mode: "app",
          flow: galleryItems[this.currentItem].url,
          guestPrefixed: true,
        })}
      >
        Try now
      </a>
    </div>`;
  }

  #maybeRenderModalDialog() {
    if (!this.showingModal) {
      return nothing;
    }

    return html`<landing-carousel-modal
      @close=${() => {
        this.showingModal = false;
      }}
      .idx=${this.#modalItem}
      .appName=${this.appName}
    ></landing-carousel-modal>`;
  }

  render() {
    return [this.#renderCarousel(), this.#maybeRenderModalDialog()];
  }
}
