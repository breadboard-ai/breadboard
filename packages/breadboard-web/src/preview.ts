/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { customElement, property } from "lit/decorators.js";
import { LitElement, css, html, nothing } from "lit";
import { asRuntimeKit } from "@google-labs/breadboard";
export { PreviewRun } from "./preview-run.js";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import PaLMKit from "@google-labs/palm-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit";

const fetchAndLoadKits = async () => {
  const response = await fetch(`${self.location.origin}/kits.json`);
  const kitList = await response.json();

  const kits = await Promise.all(
    kitList.map(async (kit: string) => {
      const module = await import(`${kit}`);

      if (module.default == undefined) {
        throw new Error(`Module ${kit} does not have a default export.`);
      }

      const moduleKeys = Object.getOwnPropertyNames(module.default.prototype);

      if (
        moduleKeys.includes("constructor") == false ||
        moduleKeys.includes("handlers") == false
      ) {
        throw new Error(
          `Module default export '${kit}' does not look like a Kit (either no constructor or no handler).`
        );
      }
      return module.default;
    })
  );

  return kits;
};

const kits = [
  TemplateKit,
  Core,
  PaLMKit,
  GeminiKit,
  NodeNurseryWeb,
  JSONKit,
  AgentKit,
  ...(await fetchAndLoadKits()),
].map((kitConstructor) => asRuntimeKit(kitConstructor));

@customElement("bb-preview")
export class Preview extends LitElement {
  @property({ reflect: true })
  embed = false;

  #url: string | null = null;

  static styles = css`
    :host {
      display: block;
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
  `;

  constructor() {
    super();

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    const embedFromUrl = currentUrl.searchParams.get("embed") !== null;
    if (!boardFromUrl) {
      console.warn("No Board URL provided - exiting");
      return;
    }

    this.embed = embedFromUrl;

    this.#url = boardFromUrl;
  }

  render() {
    if (!this.#url) {
      return nothing;
    }

    return html`<bb-preview-run
      url=${this.#url}
      .kits=${kits}
    ></bb-preview-run>`;
  }
}
