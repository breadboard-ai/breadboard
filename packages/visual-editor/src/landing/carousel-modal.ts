/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { galleryItems } from "./gallery-items.js";
import { fonts } from "./fonts.js";
import { shortestPath } from "./utils.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { map } from "lit/directives/map.js";
import { makeUrl } from "../ui/navigation/urls.js";

@customElement("landing-carousel-modal")
export class LandingCarouselModal extends LitElement {
  @property()
  accessor idx = 0;

  @property()
  accessor appName = "";

  @property()
  accessor currentItem = -1;

  @property()
  accessor interactionLocked = false;

  static styles = [
    fonts,
    css`
      :host {
        display: block;
        user-select: none;
      }

      dialog {
        animation: fadeIn 0.4s cubic-bezier(0, 0, 0.3, 1) 0.2s backwards;
        background: oklch(
          from var(--light-dark-n-100) l c h / calc(alpha * 0.4)
        );
        border: none;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        max-width: none;
        max-height: none;

        & #container {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-rows: minmax(100px, 1fr) 4fr 200px;
          gap: 32px;
          overflow: hidden;

          & header {
            display: flex;
            align-items: end;
            justify-content: center;

            & h1 {
              font-size: 20px;
              margin: 0;
            }

            & #close {
              position: absolute;
              top: var(--bb-grid-size-6);
              right: var(--bb-grid-size-6);
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              background: var(--light-dark-n-0);
              border: none;
              color: var(--light-dark-n-100);
              width: 56px;
              height: 56px;
              cursor: pointer;

              & .g-icon {
                font-size: 32px;
              }
            }
          }

          & #items {
            position: relative;
            mask: linear-gradient(
              to right,
              #ff00ff00,
              #ff00ff 40px,
              #ff00ff,
              #ff00ff calc(100% - 40px),
              #ff00ff00
            );

            .card {
              position: absolute;
              top: 50%;
              left: 50%;
              height: 90%;
              aspect-ratio: 322 / 628;
              transition: transform 0.4s cubic-bezier(0, 0, 0.3, 1);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 var(--bb-grid-size-4);

              &.hidden {
                opacity: 0;
              }

              & picture {
                overflow: hidden;
                aspect-ratio: 322 / 628;
                display: block;
                border-radius: 32px;
                height: 100%;
                box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.1);
                background: #f0f0f0;

                & img {
                  display: block;
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                }
              }
            }
          }

          & footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 56px 1fr;
            column-gap: var(--bb-grid-size-4);
            row-gap: var(--bb-grid-size-10);

            & .navigation {
              border-radius: 50%;
              background: var(--light-dark-n-0);
              color: var(--light-dark-n-100);
              display: flex;
              align-items: center;
              justify-content: center;
              width: var(--bb-grid-size-14);
              height: var(--bb-grid-size-14);
              font-size: var(--bb-grid-size-8);
              border: none;
              cursor: pointer;

              & .g-icon {
                font-size: 32px;
                pointer-events: none;
              }
            }

            & #prev {
              order: 1;
              justify-self: end;
              background: var(--n-0);
              color: var(--n-100);
            }

            & #next {
              order: 2;
              justify-self: start;
              background: var(--n-0);
              color: var(--n-100);
            }

            & .try-app {
              order: 3;
              grid-column: 1/3;
              justify-self: center;
              text-decoration: none;
            }

            & .try-app {
              display: flex;
              align-items: center;
              border: none;
              font-size: 16px;
              background: var(--n-0);
              color: var(--n-100);
              border-radius: 60px;
              height: 56px;
              padding: 0 var(--bb-grid-size-6);
              white-space: nowrap;
              cursor: pointer;
              gap: var(--bb-grid-size-2);

              &.sticky {
                position: absolute;
                bottom: 10%;
                left: 50%;
                translate: -50% 0;
              }
            }
          }
        }
      }

      @media (prefers-reduced-motion: reduce) {
        dialog #items #container .card {
          transition: none;
        }
      }

      @media (min-width: 800px) {
        dialog #container {
          gap: 48px;
          grid-template-rows: minmax(100px, 1fr) 4fr 100px;

          & header {
            & h1 {
              font-size: 32px;
            }

            & #close {
              top: var(--bb-grid-size-16);
              right: var(--bb-grid-size-16);
            }
          }

          & #items {
            & .card {
              padding: 0 var(--bb-grid-size-16);
              aspect-ratio: 1004 / 630;

              & picture {
                aspect-ratio: 1004 / 630;
              }
            }
          }

          & footer {
            display: flex;
            align-items: start;
            justify-content: center;
            gap: var(--bb-grid-size-8);

            & #prev {
              order: 1;
            }

            & .try-app {
              order: 2;
            }

            & #next {
              order: 3;
            }
          }
        }
      }

      dialog::backdrop {
        background: oklch(
          from var(--light-dark-n-100) l c h / calc(alpha * 0.1)
        );
        animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
        backdrop-filter: blur(16px);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }

      @keyframes fadeInAndSlide {
        from {
          opacity: 0;
          translate: 0 10px;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  @query("#container")
  accessor #container: HTMLElement | null = null;

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("idx") && this.currentItem === -1) {
      this.currentItem = this.idx;
    }
  }

  #close() {
    this.dispatchEvent(new Event("close"));
  }

  render() {
    return html`<dialog
      @click=${(evt: Event) => {
        const els = evt.composedPath();
        if (els.some((el) => el === this.#container)) {
          return;
        }

        this.#close();
      }}
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }
        evt.preventDefault();
        this.#close();
      }}
      ${ref((el?: Element) => {
        if (!el) {
          return;
        }

        const dialog = el as HTMLDialogElement;
        requestAnimationFrame(() => {
          dialog.showModal();
        });
      })}
    >
      <section
        @transitionend=${() => {
          this.interactionLocked = false;
        }}
        id="container"
        part="container"
        class="sans md-body-medium"
      >
        <header>
          <button
            id="close"
            @click=${() => {
              this.#close();
            }}
          >
            <span class="g-icon">close</span>
          </button>
          <h1 class="sans-flex w-400 round">Try this ${this.appName} app</h1>
        </header>
        <div id="items">
          ${map(galleryItems, (val, idx) => {
            const circularIdx = shortestPath(
              this.currentItem,
              idx,
              galleryItems.length
            );

            return html`<div
              class=${classMap({
                card: true,
                current: idx === this.currentItem,
                hidden: Math.abs(circularIdx) > 3,
              })}
              style=${styleMap({
                transform: `translate(-50%, -50%) translate(${circularIdx * 100}%, 0)`,
              })}
            >
              <picture>
                <source media="(max-width: 799px)" srcset=${val.mobileImg} />
                <img src=${val.desktopImg} alt=${val.description} />
              </picture>
            </div>`;
          })}
        </div>
        <footer>
          <button
            class="navigation"
            id="prev"
            @click=${() => {
              if (this.interactionLocked) {
                return;
              }
              this.currentItem--;
              if (this.currentItem < 0) {
                this.currentItem = galleryItems.length - 1;
              }
              this.interactionLocked = true;
            }}
          >
            <span class="g-icon filled round">chevron_left</span>
          </button>
          <a
            class="try-app"
            .href=${makeUrl({
              page: "graph",
              mode: "app",
              flow: galleryItems[this.currentItem].url,
              guestPrefixed: true,
            })}
          >
            Try now
          </a>

          <button
            class="navigation"
            id="next"
            @click=${() => {
              if (this.interactionLocked) {
                return;
              }
              this.currentItem++;
              this.currentItem %= galleryItems.length;
              this.interactionLocked = true;
            }}
          >
            <span class="g-icon filled round">chevron_right</span>
          </button>
        </footer>
      </section>
    </dialog>`;
  }
}
