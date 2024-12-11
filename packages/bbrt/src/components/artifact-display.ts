/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Signal } from "signal-polyfill";
import type { ReactiveArtifact } from "../artifacts/reactive-artifact-store.js";
import "./board-visualizer.js";

@customElement("bbrt-artifact-display")
export class BBRTArtifactDisplay extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  artifact?: Signal.State<ReactiveArtifact | undefined>;

  static override styles = css`
    :host {
      display: flex;
    }
    :host > * {
      flex-grow: 1;
    }
  `;

  override render() {
    const task = this.artifact?.get()?.arrayBuffer;
    if (task === undefined) {
      return nothing;
    }

    // TODO(aomarks) Bug in AsyncComputed, will be fixed once
    // https://github.com/proposal-signals/signal-utils/pull/88 is released.
    task.get();

    if (task.status === "error") {
      return html`<div>Internal error: ${task.error}</div>`;
    }
    if (task.status === "pending") {
      return html`<div>Loading...</div>`;
    }
    const artifact = task.value;
    if (artifact === undefined) {
      // TODO(aomarks) Is this possible?
      return nothing;
    }

    if (artifact.mimeType === "application/vnd.breadboard.board") {
      const board = JSON.parse(
        new TextDecoder().decode(artifact.buffer)
      ) as GraphDescriptor;
      console.log({ board });
      return html`
        <bbrt-board-visualizer .graph=${board}></bbrt-board-visualizer>
      `;
    }
    return html`<div>Unknown artifact type: ${artifact.mimeType}</div>`;
  }
}

declare global {
  interface BBRTArtifactDisplay {
    "bbrt-artifact-display": BBRTArtifactDisplay;
  }
}
