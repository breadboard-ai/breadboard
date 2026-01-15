/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeCSS } from "lit";
import { Task } from "@lit/task";

@customElement("a2ui-custom-pdf-viewer")
export class A2UICustomPDFViewer extends A2UI.v0_8.UI.Root {
  @property()
  accessor fileUri: A2UI.v0_8.Primitives.StringValue | null = null;

  @property()
  accessor url: A2UI.v0_8.Primitives.StringValue | null = null;

  static styles = [
    unsafeCSS(A2UI.v0_8.Styles.structuralStyles),
    css`
      :host {
        display: block;
        aspect-ratio: 3/4;
        overflow: auto;
        min-height: 1;
        flex: 1;
      }

      section {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      bb-pdf-viewer {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  #partTask = new Map<string, Task>();
  disconnectedCallback(): void {
    super.disconnectedCallback();

    for (const task of this.#partTask.values()) {
      task.abort();
    }

    this.#partTask.clear();
  }

  #createPDFLoadTask(url: string) {
    const task = new Task(this, {
      task: async ([url]) => {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        return data;
      },
      args: () => [url],
    });

    task.autoRun = false;
    return task;
  }

  #renderPDF() {
    const fileUri = A2UI.v0_8.UI.Utils.extractStringValue(
      this.fileUri,
      this.component,
      this.processor,
      this.surfaceId
    );
    const url = A2UI.v0_8.UI.Utils.extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    const pdfUrl = fileUri || url;
    if (!pdfUrl) return html`Unable to render PDF`;

    let partTask = this.#partTask.get(pdfUrl);
    if (!partTask) {
      partTask = this.#createPDFLoadTask(pdfUrl);
      this.#partTask.set(pdfUrl, partTask);
      partTask.run();
    }

    return partTask.render({
      initial: () => html`Waiting to load PDF...`,
      pending: () => html`Loading PDF`,
      complete: (pdfData) => {
        return html`<bb-pdf-viewer
          .showControls=${false}
          .data=${pdfData}
        ></bb-pdf-viewer>`;
      },
      error: () => html`Unable to load PDF`,
    });
  }

  render() {
    return html`<section class="layout-el-cv layout-w-100 layout-h-100">
      ${this.#renderPDF()}
    </section>`;
  }
}
