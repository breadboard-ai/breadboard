/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview PDF viewer component built on pdfjs-dist.
 *
 * ## Architecture
 *
 * The viewer follows a **Task → willUpdate → content promise → until()**
 * pipeline:
 *
 * 1. **Lit Task** (`#pdfTask`) lazily loads pdfjs-dist and opens the document
 *    whenever `data` or `url` changes.
 * 2. **`willUpdate`** detects when the Task delivers a new PDF (or when zoom /
 *    page changes) and sets `#content` to a fresh render promise.
 * 3. **`render()`** uses `until(this.#content)` to bridge the async render
 *    into Lit's template. The canvas DOM node is owned by Lit's template
 *    system — never appended imperatively.
 *
 * ## Zoom & Layout
 *
 * Zoom is baked into the pdfjs viewport scale (`zoom * devicePixelRatio`),
 * which grows the canvas pixel buffer. CSS dimensions are set to
 * `pixels / dPR` so the visual size matches the zoom level accurately.
 *
 * The critical layout rule is `contain: size` on `:host`. Without it,
 * `height: 100%` can resolve to `auto` when no ancestor provides an explicit
 * height, causing the element to grow with the canvas and leak scroll to
 * ancestors. `contain: size` ensures the element never sizes from its
 * children, so `overflow: auto` on `#container` reliably contains the
 * scrollable canvas.
 *
 * ## Controls
 *
 * Hover-to-show overlay at bottom-right, matching the `a2ui-image` pattern.
 * Zoom buttons use ×1.1 / ÷1.1 (10% increments). Multi-page PDFs get a
 * paging "super button" — a single continuous dark block with
 * back / page-number / next.
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
import { icons } from "../../../styles/icons.js";
import { Task, TaskStatus } from "@lit/task";
import type { RenderTask, PDFDocumentProxy } from "pdfjs-dist";

type PDFJS = typeof import("pdfjs-dist");

// ── pdfjs-dist lazy loader ───────────────────────────────────────────────────

/** Module-level cache so we only import pdfjs once across all instances. */
let pdfjsLib: PDFJS | null = null;

async function loadPDFJS(): Promise<PDFJS> {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.href;
  pdfjsLib = pdfjs;
  return pdfjs;
}

// ── Component ────────────────────────────────────────────────────────────────

@customElement("bb-pdf-viewer")
export class PDFViewer extends LitElement {
  /**
   * Raw PDF bytes. Use this for inline data that's already in memory.
   * Mutually exclusive with `url`.
   */
  @property({ attribute: false })
  accessor data: ArrayBuffer | null = null;

  /**
   * URL to fetch the PDF from. The viewer handles the fetch internally.
   * Mutually exclusive with `data`.
   */
  @property()
  accessor url: string | null = null;

  /** Whether to show the hover overlay controls (zoom, fit, download, paging). */
  @property({ reflect: true })
  accessor showControls = false;

  /**
   * Current zoom level. 1 = PDF's native 72 dpi size. Values are clamped
   * to [0.1, 10] in `willUpdate`. On first render, this is automatically
   * set to fit the page within the container.
   */
  @property()
  accessor zoom = 1;

  /** Current 1-indexed page number. */
  @property()
  accessor page = 1;

  // ── Styles ───────────────────────────────────────────────────────────

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      /*
       * contain: size — critical. Without it, height: 100% can resolve to
       * auto (content height) when the parent lacks an explicit height.
       * The element would then grow with the canvas, and overflow: hidden
       * wouldn't clip anything. contain: size ensures the element is never
       * sized by its children.
       */
      :host {
        display: block;
        contain: size;
        overflow: hidden;
        width: 100%;
        height: 100%;
        background: var(--light-dark-nv-98);
        border-radius: var(--bb-grid-size-5);
      }

      /* Positioning context for absolute controls overlay. */
      #wrapper {
        position: relative;
        width: 100%;
        height: 100%;
      }

      /*
       * Scrollable viewport for zoomed-in content. Scrollbars are hidden
       * across all browsers to keep the visual clean — users scroll via
       * trackpad/touch/mouse wheel.
       */
      #container {
        width: 100%;
        height: 100%;
        padding: 8px;
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      #container::-webkit-scrollbar {
        display: none;
      }

      /* margin: auto centers the canvas when it's smaller than #container. */
      canvas {
        display: block;
        margin: auto;
        image-rendering: smooth;
      }

      /* ── Hover overlay controls ─────────────────────────────────── */

      #controls {
        position: absolute;
        bottom: var(--bb-grid-size-4, 16px);
        right: var(--bb-grid-size-4, 16px);
        display: flex;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: 1;
        pointer-events: none;
      }

      #wrapper:hover #controls {
        opacity: 1;
        pointer-events: auto;
      }

      #controls button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: var(--bb-grid-size-2, 10px);
        background: oklch(0 0 0 / 0.5);
        color: white;
        cursor: pointer;
        transition: background 0.2s ease;

        &:hover {
          background: oklch(0 0 0 / 0.7);
        }

        &[disabled] {
          opacity: 0.4;
          cursor: default;
        }
      }

      /*
       * Paging "super button" — a single continuous dark block containing
       * back / page-number / next. Buttons inside inherit the shared
       * background and only show a hover highlight. Disabled buttons stay
       * fully opaque (no stacking with the container's background) and
       * instead dim their icon color.
       */
      #controls .paging {
        display: flex;
        align-items: center;
        height: 36px;
        border-radius: var(--bb-grid-size-2, 10px);
        background: oklch(0 0 0 / 0.5);
        overflow: hidden;

        & button {
          background: transparent;
          border-radius: 0;

          &:hover:not([disabled]) {
            background: oklch(0 0 0 / 0.3);
          }

          &[disabled] {
            opacity: 1;
            color: oklch(1 0 0 / 0.3);
          }
        }

        & .page-num {
          color: white;
          font: 500 var(--bb-body-small, 12px) / 1
            var(--bb-font-family, sans-serif);
          min-width: 20px;
          text-align: center;
        }
      }
    `,
  ];

  // ── Private state ──────────────────────────────────────────────────

  /** Ref to the scrollable container, used for zoom-to-fit calculations. */
  #containerRef: Ref<HTMLDivElement> = createRef();

  /** Reused canvas element. Created once, updated on every render. */
  #canvas: HTMLCanvasElement | null = null;

  /** In-flight pdfjs render task, cancelled when a new render starts. */
  #activeRender: RenderTask | null = null;

  /** Guards the `load` event so it fires exactly once per document. */
  #loadDispatched = false;

  /** Whether the initial zoom-to-fit has been performed. */
  #hasInitialZoom = false;

  /**
   * PDF page dimensions in points (at viewport scale=1). Cached after the
   * first render so #zoomToFit can be called later without re-fetching the
   * page.
   */
  #pageWidth = 0;
  #pageHeight = 0;

  /** Resolved ArrayBuffer for download, whether supplied or fetched. */
  #resolvedBytes: ArrayBuffer | null = null;

  /** The rendered content promise, consumed by `until()` in the template. */
  #content: Promise<HTMLTemplateResult> | null = null;

  /** Tracks the last PDF document to detect when a new one arrives. */
  #lastPdf: PDFDocumentProxy | null = null;

  #rafId = 0;
  #resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(this.#rafId);
    this.#rafId = requestAnimationFrame(() => {
      this.requestUpdate();
    });
  });

  // ── Lit Task: load pdfjs + open document ───────────────────────────

  /**
   * Reactive Task that loads pdfjs-dist and opens the PDF document.
   * Re-runs automatically when `data` or `url` changes. The resolved
   * PDFDocumentProxy is picked up by `willUpdate`.
   */
  #pdfTask = new Task(this, {
    task: async ([data, url]: [ArrayBuffer | null, string | null]) => {
      if (!data && !url) {
        return null;
      }

      const lib = await loadPDFJS();

      let bytes = data;
      if (!bytes && url) {
        const response = await fetch(url);
        bytes = await response.arrayBuffer();
      }
      if (!bytes) {
        throw new Error("No PDF data provided");
      }

      // Copy bytes for download — pdfjs transfers the buffer to its worker,
      // which detaches the original.
      this.#resolvedBytes = bytes.slice(0);
      return lib.getDocument({ data: bytes }).promise;
    },
    args: () => [this.data, this.url] as [ArrayBuffer | null, string | null],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
    cancelAnimationFrame(this.#rafId);
    this.#activeRender?.cancel();

    if (this.#pdfTask.status === TaskStatus.COMPLETE && this.#pdfTask.value) {
      const pdf = this.#pdfTask.value as PDFDocumentProxy;
      pdf.destroy();
    }
  }

  protected firstUpdated(): void {
    if (this.#containerRef.value) {
      this.#resizeObserver.observe(this.#containerRef.value);
    }
  }

  /**
   * Central coordination point. Detects three triggers:
   * 1. Zoom property changed → clamp to [0.1, 10].
   * 2. Task delivered a new PDFDocumentProxy.
   * 3. Zoom or page changed on an existing PDF.
   *
   * Any of these triggers a fresh `#renderToCanvas` call, whose promise
   * is stored in `#content` for consumption by `until()` in the template.
   */
  protected willUpdate(changedProperties: PropertyValues): void {
    // Clamp zoom so the stored value always matches what's rendered.
    if (changedProperties.has("zoom")) {
      this.zoom = Math.max(0.1, Math.min(10, this.zoom));
    }

    // Detect when the Task has delivered a new PDF document.
    const pdf =
      this.#pdfTask.status === TaskStatus.COMPLETE
        ? (this.#pdfTask.value as PDFDocumentProxy | null)
        : null;
    const pdfChanged = pdf !== null && pdf !== this.#lastPdf;
    if (pdfChanged) {
      this.#lastPdf = pdf;
    }

    // Rebuild the content promise whenever the PDF, zoom, or page changes.
    if (
      pdf &&
      (pdfChanged ||
        changedProperties.has("zoom") ||
        changedProperties.has("page"))
    ) {
      this.#content = this.#renderToCanvas(pdf);
    }
  }

  // ── Canvas rendering ───────────────────────────────────────────────

  /**
   * Renders a single PDF page to the shared canvas element.
   *
   * The canvas uses the standard high-DPI pattern:
   * - **Pixel dimensions** (`canvas.width/height`): `zoom * dPR * pageSize`
   *   — determines the rendered resolution.
   * - **CSS dimensions** (`canvas.style.width/height`): `zoom * pageSize`
   *   — determines the visual size on screen.
   *
   * This means the canvas CSS size grows/shrinks with zoom, which is
   * how overflow scrolling works. `#container` has `overflow: auto` and
   * `contain: size` on `:host` prevents the growing canvas from pushing
   * ancestor elements larger.
   */
  async #renderToCanvas(pdf: PDFDocumentProxy): Promise<HTMLTemplateResult> {
    // Cancel any in-flight render.
    if (this.#activeRender) {
      this.#activeRender.cancel();
      this.#activeRender = null;
    }

    const pdfPage = await pdf.getPage(this.page);
    const dPR = window.devicePixelRatio ?? 1;

    if (!this.#canvas) {
      this.#canvas = document.createElement("canvas");
    }

    // On first render, calculate zoom so the page fits the container.
    if (!this.#hasInitialZoom) {
      this.#hasInitialZoom = true;
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      this.#zoomToFit(baseViewport.width, baseViewport.height);
    }

    // Zoom is baked into the viewport scale — the canvas grows on zoom-in,
    // and #container (overflow: auto) handles scrolling.
    const viewport = pdfPage.getViewport({ scale: this.zoom * dPR });

    // Set pixel buffer (resolution).
    this.#canvas.width = viewport.width;
    this.#canvas.height = viewport.height;

    // Set CSS dimensions (visual size) — divide by dPR for correct 1x sizing.
    this.#canvas.style.width = `${viewport.width / dPR}px`;
    this.#canvas.style.height = `${viewport.height / dPR}px`;

    const ctx = this.#canvas.getContext("2d")!;
    const renderTask = pdfPage.render({
      canvas: this.#canvas,
      canvasContext: ctx,
      viewport,
    });
    this.#activeRender = renderTask;

    try {
      await renderTask.promise;
    } catch (err: unknown) {
      // pdfjs throws when a render is cancelled — that's expected.
      if (
        err instanceof Error &&
        (err.message.includes("Rendering cancelled") ||
          err.message.includes("cancelled"))
      ) {
        return html`${this.#canvas}`;
      }
      return html`Unable to render PDF`;
    } finally {
      this.#activeRender = null;
    }

    if (!this.#loadDispatched) {
      this.#loadDispatched = true;
      this.dispatchEvent(new Event("load"));
    }

    return html`${this.#canvas}`;
  }

  // ── Zoom ───────────────────────────────────────────────────────────

  /**
   * Sets `this.zoom` so the full page fits within the container. On first
   * call, caches the page's natural dimensions (PDF points at scale=1) so
   * subsequent calls (e.g. from the fit_screen button) don't need to
   * re-fetch the page.
   */
  #zoomToFit(pageWidth?: number, pageHeight?: number): void {
    if (pageWidth) this.#pageWidth = pageWidth;
    if (pageHeight) this.#pageHeight = pageHeight;

    const container = this.#containerRef.value;
    if (!container || !this.#pageWidth || !this.#pageHeight) {
      return;
    }

    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    // Account for container padding (8px each side).
    const availWidth = clientWidth - 16;
    const availHeight = clientHeight - 16;

    this.zoom = Math.min(
      availWidth / this.#pageWidth,
      availHeight / this.#pageHeight
    );
  }

  // ── Download ───────────────────────────────────────────────────────

  /** Triggers a browser download of the PDF using the resolved bytes. */
  #download(): void {
    const bytes = this.#resolvedBytes;
    if (!bytes) {
      return;
    }

    const blob = new Blob([bytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "document.pdf";
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  // ── Derived getters ────────────────────────────────────────────────

  /** Total number of pages in the loaded PDF (0 while loading). */
  get #pages(): number {
    if (this.#pdfTask.status !== TaskStatus.COMPLETE || !this.#pdfTask.value) {
      return 0;
    }
    return (this.#pdfTask.value as PDFDocumentProxy).numPages;
  }

  /** Whether controls should be disabled (PDF still loading). */
  get #disabled(): boolean {
    return this.#pdfTask.status === TaskStatus.PENDING;
  }

  // ── Template ───────────────────────────────────────────────────────

  render(): HTMLTemplateResult {
    return html`<div id="wrapper">
      <div id="container" ${ref(this.#containerRef)}>
        ${until(this.#content)}
      </div>
      ${this.showControls
        ? html`<div id="controls">
            <button
              ?disabled=${this.#disabled}
              @click=${() => {
                this.zoom /= 1.1;
              }}
            >
              <span class="g-icon filled round">remove</span>
            </button>
            <button
              ?disabled=${this.#disabled}
              @click=${() => {
                this.zoom *= 1.1;
              }}
            >
              <span class="g-icon filled round">add</span>
            </button>
            <button
              ?disabled=${this.#disabled}
              @click=${() => {
                this.#zoomToFit();
              }}
            >
              <span class="g-icon filled round">fit_screen</span>
            </button>
            <button
              ?disabled=${this.#disabled || !this.#resolvedBytes}
              @click=${() => {
                this.#download();
              }}
            >
              <span class="g-icon round">download</span>
            </button>
            ${this.#pages > 1
              ? html`<div class="paging">
                  <button
                    ?disabled=${this.#disabled || this.page <= 1}
                    @click=${() => {
                      this.page--;
                    }}
                  >
                    <span class="g-icon round">navigate_before</span>
                  </button>
                  <span class="page-num">${this.page}</span>
                  <button
                    ?disabled=${this.#disabled || this.page >= this.#pages}
                    @click=${() => {
                      this.page++;
                    }}
                  >
                    <span class="g-icon round">navigate_next</span>
                  </button>
                </div>`
              : nothing}
          </div>`
        : nothing}
    </div>`;
  }
}
