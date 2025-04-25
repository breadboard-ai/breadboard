/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LitElement,
  html,
  css,
  PropertyValues,
  HTMLTemplateResult,
  nothing,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import type { PageViewport, PDFDocumentProxy } from "pdfjs-dist";

type PDFJS = typeof import("pdfjs-dist");
type PDFLoadResult = { lib: PDFJS; data: ArrayBuffer } | null;

const dPR = window.devicePixelRatio ?? 1;

@customElement("bb-pdf-viewer")
export class PDFViewer extends LitElement {
  @property()
  accessor data: ArrayBuffer | null = null;

  @property({ reflect: true })
  accessor showControls = false;

  @property()
  accessor zoom = 1;

  @property()
  accessor page = 1;

  @property()
  accessor disabled = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      overflow: auto;
      width: 100%;
      height: 100%;
    }

    #controls {
      height: var(--bb-grid-size-11);
      display: flex;
      align-items: center;
      justify-content: space-between;

      & > div {
        display: flex;
        align-items: center;

        &#zoom {
          padding-left: var(--bb-grid-size-2);
        }
      }

      & button {
        margin: 0 var(--bb-grid-size) 0 0;
        border: none;
        font-size: 0;
        width: 20px;
        height: 20px;
        padding: 0;
        background: var(--bb-neutral-50);
        opacity: 0.5;

        &:not([disabled]) {
          cursor: pointer;
          opacity: 1;
        }

        &#zoom-out {
          background: var(--bb-icon-zoom-out) center center / 20px 20px
            no-repeat;
        }

        &#zoom-in {
          background: var(--bb-icon-zoom-in) center center / 20px 20px no-repeat;
        }

        &#fill {
          background: var(--bb-icon-view-real-size) center center / 20px 20px
            no-repeat;
        }

        &#fit {
          background: var(--bb-icon-fit) center center / 20px 20px no-repeat;
        }

        &#next {
          background: var(--bb-icon-next) center center / 20px 20px no-repeat;
        }

        &#back {
          background: var(--bb-icon-before) center center / 20px 20px no-repeat;
        }
      }
    }

    .pages {
      text-align: center;
      min-width: var(--bb-grid-size-4);
    }

    #container {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;

      padding: 8px;
      border: 1px solid var(--bb-neutral-100);
      background: var(--bb-neutral-50);
      overflow: scroll;
      scrollbar-width: none;

      & #inner-container {
        & canvas {
          object-fit: contain;
          image-rendering: smooth;
        }
      }
    }

    :host([showcontrols="true"]) {
      #container {
        height: calc(100% - var(--bb-grid-size-11));
      }
    }
  `;

  #libraryLoaded: Promise<PDFJS> | null = null;
  #pdfFile: Promise<PDFDocumentProxy | null> | null = null;
  #content: Promise<HTMLTemplateResult> | null = null;
  #containerRef: Ref<HTMLDivElement> = createRef();
  #canvas = document.createElement("canvas");
  #bounds = new DOMRectReadOnly();
  #baseViewport: PageViewport | null = null;
  #pages = 0;
  #resizeObserver = new ResizeObserver((entries) => {
    const [entry] = entries;
    this.#bounds = entry.contentRect;
  });

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  async #loadLib() {
    const pdfjs = await import("pdfjs-dist");
    const pdfjsWorkerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    );

    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl.href;

    return pdfjs;
  }

  protected firstUpdated(): void {
    if (!this.#containerRef.value) {
      return;
    }

    this.#resizeObserver.observe(this.#containerRef.value);
  }

  #initialRender = true;
  #isRendering = false;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("data")) {
      this.disabled = true;
      if (!this.#libraryLoaded) {
        this.#libraryLoaded = this.#loadLib();
      }

      this.#pdfFile = this.#libraryLoaded
        .then<PDFLoadResult>((lib) => {
          if (!this.data) {
            return null;
          }

          return { lib, data: this.data };
        })
        .then<PDFDocumentProxy | null>((loadResult) => {
          if (!loadResult) {
            return null;
          }

          const pdfjsLib = loadResult.lib;
          const loadingTask = pdfjsLib.getDocument({ data: loadResult.data });
          return loadingTask.promise;
        });
    }

    if (changedProperties.has("page")) {
      this.disabled = true;
      this.#baseViewport = null;
    }

    if (changedProperties.has("zoom") || changedProperties.has("page")) {
      this.disabled = true;
      if (!this.#pdfFile) {
        return;
      }

      this.#content = this.#pdfFile.then(async (pdfDocument) => {
        if (!pdfDocument || !this.#canvas) {
          return html`Unable to render`;
        }

        const pdfPage = await pdfDocument.getPage(this.page);

        // Get the current page's size for fit-to-screen.
        if (!this.#baseViewport) {
          this.#baseViewport = pdfPage.getViewport({
            scale: dPR,
          });

          this.#zoomToFit();
        }

        if (this.#pages === 0) {
          this.#pages = pdfDocument.numPages;
        }

        const canvas = this.#canvas;
        const ctx = canvas.getContext("2d")!;
        if (this.#isRendering) {
          return html`${canvas}`;
        }

        const viewport = pdfPage.getViewport({
          scale: this.zoom * dPR,
        });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        this.#isRendering = true;
        const renderTask = pdfPage.render({
          canvasContext: ctx,
          viewport,
        });

        await renderTask.promise;

        if (this.#initialRender) {
          this.#initialRender = false;
          this.dispatchEvent(new Event("pdfinitialrender"));
        }

        this.disabled = false;
        this.#isRendering = false;

        return html`${canvas}`;
      });
    }
  }

  #clamp(value: number, min: number, max: number) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  #zoomToFit() {
    if (
      this.#bounds.width === 0 ||
      this.#bounds.height === 0 ||
      !this.#baseViewport
    ) {
      return;
    }

    this.zoom = Math.min(
      (this.#bounds.width - this.#bounds.left) / this.#baseViewport.width,
      (this.#bounds.height - this.#bounds.top) / this.#baseViewport.height
    );
  }

  render() {
    return html` ${this.showControls
        ? html`<div id="controls">
            <div id="zoom">
              <button
                ?disabled=${this.disabled}
                id="zoom-out"
                @click=${() => {
                  this.zoom = this.#clamp(this.zoom - 0.25, 0.1, 10);
                }}
              >
                -</button
              ><button
                ?disabled=${this.disabled}
                id="zoom-in"
                @click=${() => {
                  this.zoom = this.#clamp(this.zoom + 0.25, 0.1, 10);
                }}
              >
                +
              </button>
              <button
                ?disabled=${this.disabled}
                id="fill"
                @click=${() => {
                  this.zoom = 1;
                }}
              >
                Fill
              </button>

              <button
                ?disabled=${this.disabled}
                id="fit"
                @click=${() => {
                  this.#zoomToFit();
                }}
              >
                Zoom to Fit
              </button>
            </div>

            <div id="paging">
              <button
                ?disabled=${this.disabled || this.page <= 1}
                id="back"
                @click=${() => {
                  this.page--;
                }}
              >
                Back
              </button>
              <span class="pages">${this.page}</span>
              <button
                ?disabled=${this.disabled || this.page >= this.#pages}
                id="next"
                @click=${() => {
                  this.page++;
                }}
              >
                Next
              </button>
            </div>
          </div>`
        : nothing}
      <div id="container" ${ref(this.#containerRef)}>
        <div id="inner-container">${until(this.#content)}</div>
      </div>`;
  }
}
