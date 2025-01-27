/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ValidateResult, type InspectablePort } from "@google-labs/breadboard";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./fancy-json.js";

@customElement("bb-port-tooltip")
export class PortTooltip extends LitElement {
  #port?: InspectablePort;
  #latestValidateRequest?: symbol;

  get port(): InspectablePort | undefined {
    return this.#port;
  }

  @property({ reflect: false, type: Object })
  set port(port: InspectablePort | undefined) {
    this.#port = port;
    this.#latestValidateRequest = undefined;
    this._validation = undefined;
    if (port === undefined) {
      return;
    }
    const firstWire = port.edges[0];
    if (firstWire === undefined) {
      return;
    }
    const thisRequest = Symbol();
    this.#latestValidateRequest = thisRequest;
    firstWire.validate().then((validation) => {
      if (thisRequest === this.#latestValidateRequest) {
        this._validation = validation;
        this.#latestValidateRequest = undefined;
      }
    });
  }

  @state()
  private accessor _validation: ValidateResult | undefined = undefined;

  static styles = css`
    pre {
      font-size: 12px;
      padding: 2px 12px;
      width: 350px;
    }
    bb-fancy-json::part(error) {
      text-decoration: wavy red underline;
    }
  `;

  override render() {
    if (!this.port) {
      return nothing;
    }
    const info = {
      name: this.port.name,
      title: this.port.title,
      status: this.port.status,
      configured: this.port.configured,
      schema: this.port.schema,
    };
    const annotations = [];
    if (this._validation?.status === "invalid") {
      const firstError = this._validation.errors[0];
      if (firstError.detail) {
        const path =
          this.port.kind === "output"
            ? firstError.detail.outputPath
            : firstError.detail.inputPath;
        annotations.push({ path: ["schema", ...path], partName: "error" });
      }
    }
    return html`<pre><bb-fancy-json
      .json=${info}
      .annotations=${annotations}
    ></bb-fancy-json></pre>`;
  }
}
