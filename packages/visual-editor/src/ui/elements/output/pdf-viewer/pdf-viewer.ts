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
import { icons } from "../../../styles/icons.js";
import { Task, TaskStatus } from "@lit/task";
import type { RenderTask, PageViewport, PDFDocumentProxy } from "pdfjs-dist";

type PDFJS = typeof import("pdfjs-dist");

/** Module-level cache so we only import pdfjs once across all instances. */
let pdfjsLib: PDFJS | null = null;

async function loadPDFJS(): Promise<PDFJS> {
  if (pdfjsLib) {
    return pdfjsLib;
  }

  const pdfjs = await import("pdfjs-dist");
  // Must use unminified worker — it includes a critical vite-ignore
  // comment. Without it, vite attempts to import wasm files up front
  // and that fails.
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.href;
  pdfjsLib = pdfjs;
  return pdfjs;
}

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

  @property({ reflect: true })
  accessor showControls = false;

  @property()
  accessor zoom = 1;

  @property()
  accessor page = 1;

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        overflow: hidden;
        width: 100%;
        height: 100%;
        background: var(--light-dark-nv-98);
        border-radius: var(--bb-grid-size-5);
      }

      #wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      #container {
        display: block;
        width: 100%;
        height: 100%;

        padding: 8px;
        border: 1px solid var(--light-dark-nv-98);
        background: var(--light-dark-nv-98);
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        & #inner-container {
          display: block;
          overflow: auto;

          & canvas {
            display: block;
            object-fit: contain;
            image-rendering: smooth;
            margin: auto;
          }
        }
      }

      #container::-webkit-scrollbar {
        display: none;
      }

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

  #containerRef: Ref<HTMLDivElement> = createRef();
  #canvas: HTMLCanvasElement | null = null;
  #baseViewport: PageViewport | null = null;
  #activeRender: RenderTask | null = null;
  #loadDispatched = false;

  /** Resolved ArrayBuffer for download, whether supplied or fetched. */
  #resolvedBytes: ArrayBuffer | null = null;

  /** The rendered content promise, consumed by `until()` in the template. */
  #content: Promise<HTMLTemplateResult> | null = null;

  /** Tracks the last PDF document we built content for. */
  #lastPdf: PDFDocumentProxy | null = null;

  #rafId = 0;
  #resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(this.#rafId);
    this.#rafId = requestAnimationFrame(() => {
      this.requestUpdate();
    });
  });

  // ── Single Task: load pdfjs + open document ────────────────────────

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

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("page")) {
      this.#baseViewport = null;
    }

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

  async #renderToCanvas(pdf: PDFDocumentProxy): Promise<HTMLTemplateResult> {
    // Cancel any in-flight render.
    if (this.#activeRender) {
      this.#activeRender.cancel();
      this.#activeRender = null;
    }

    const pdfPage = await pdf.getPage(this.page);
    const dPR = window.devicePixelRatio ?? 1;

    // Compute base viewport for fit-to-screen on first render of a page.
    if (!this.#baseViewport) {
      this.#baseViewport = pdfPage.getViewport({ scale: dPR });
      this.#zoomToFit();
    }

    if (!this.#canvas) {
      this.#canvas = document.createElement("canvas");
    }

    const viewport = pdfPage.getViewport({ scale: this.zoom * dPR });
    this.#canvas.width = viewport.width;
    this.#canvas.height = viewport.height;

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

  #zoomToFit(): void {
    const container = this.#containerRef.value;
    if (!container || !this.#baseViewport) {
      return;
    }

    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) {
      return;
    }

    this.zoom = Math.min(
      clientWidth / this.#baseViewport.width,
      clientHeight / this.#baseViewport.height
    );
  }

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

  get #pages(): number {
    if (this.#pdfTask.status !== TaskStatus.COMPLETE || !this.#pdfTask.value) {
      return 0;
    }
    return (this.#pdfTask.value as PDFDocumentProxy).numPages;
  }

  get #disabled(): boolean {
    return this.#pdfTask.status === TaskStatus.PENDING;
  }

  render(): HTMLTemplateResult {
    return html`<div id="wrapper">
      <div id="container" ${ref(this.#containerRef)}>
        <div id="inner-container">${until(this.#content)}</div>
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
