/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import type { AsyncComputed } from "signal-utils/async-computed";
import type { ArtifactEntry } from "../artifacts/artifact-store.js";
import "./board-visualizer.js";

@customElement("bbrt-artifact-display")
export class BBRTArtifactDisplay extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor artifact: AsyncComputed<ArtifactEntry | undefined> | undefined =
    undefined;

  static override styles = css`
    :host {
      display: flex;
    }
    :host > * {
      flex-grow: 1;
    }
  `;

  override render() {
    const entry = this.artifact?.get();
    if (entry === undefined) {
      return nothing;
    }
    const task = entry.blob;
    if (task.status === "error") {
      return html`<div>Internal error: ${task.error}</div>`;
    }
    if (task.status === "pending") {
      return html`<div>Loading...</div>`;
    }
    const blob = task.value;
    if (blob === undefined) {
      return html`<div>Internal error: Missing Blob</div>`;
    }
    if (blob.type === "application/vnd.breadboard.board") {
      return until(
        entry.json.complete.then((graph) => {
          return html`
            <bbrt-board-visualizer
              .graph=${graph as GraphDescriptor}
            ></bbrt-board-visualizer>
          `;
        })
      );
    }
    return html`<div>Unknown artifact type: ${blob.type}</div>`;
  }
}

declare global {
  interface BBRTArtifactDisplay {
    "bbrt-artifact-display": BBRTArtifactDisplay;
  }
}
