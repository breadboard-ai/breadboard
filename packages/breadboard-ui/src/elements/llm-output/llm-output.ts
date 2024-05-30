/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { LLMContent } from "../../types/types.js";
import {
  isFunctionCall,
  isFunctionResponse,
  isInlineData,
  isStoredData,
  isText,
} from "../../utils/llm-content.js";
import { markdown } from "../../directives/markdown.js";
import { until } from "lit/directives/until.js";
import { cache } from "lit/directives/cache.js";
import { DataStore } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { dataStoreContext } from "../../contexts/data-store.js";

@customElement("bb-llm-output")
export class LLMOutput extends LitElement {
  @property()
  value: LLMContent | null = null;

  #partDataURLs = new Map<number, string>();

  @consume({ context: dataStoreContext })
  dataStore?: { instance: DataStore | null };

  static styles = css`
    :host {
      display: block;
      resize: vertical;
      overflow: auto;
      height: 200px;
      min-height: var(--bb-grid-size-6);
      border: 2px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      padding: var(--bb-grid-size-3) 0;
      margin-bottom: var(--bb-grid-size-2);
    }

    .content {
      display: block;
      margin-bottom: var(--bb-grid-size-2);
    }

    .value {
      display: flex;
      flex-direction: column;
      position: relative;

      margin: 0 var(--bb-grid-size-3);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);

      padding: 0 var(--bb-grid-size-3);

      white-space: normal;
      border-radius: none;
      user-select: text;
    }

    .value img,
    .value video,
    .value audio {
      width: 100%;
      max-width: 320px;
    }

    .value img,
    .value video {
      outline: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    .value .plain-text {
      white-space: pre;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
      color: var(--bb-neutral-600);
    }

    .value.markdown {
      white-space: normal;
      line-height: 1.5;
      user-select: text;
    }

    .value * {
      margin: var(--bb-grid-size) 0;
    }

    .value h1 {
      font-size: var(--bb-title-large);
      margin: calc(var(--bb-grid-size) * 4) 0 calc(var(--bb-grid-size) * 1) 0;
    }

    .value h2 {
      font-size: var(--bb-title-medium);
      margin: calc(var(--bb-grid-size) * 4) 0 calc(var(--bb-grid-size) * 1) 0;
    }

    .value h3,
    .value h4,
    .value h5 {
      font-size: var(--bb-title-small);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
    }

    .value p {
      font-size: var(--bb-body-medium);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
      white-space: pre-line;
    }

    .value h1:first-of-type,
    .value h2:first-of-type,
    .value h3:first-of-type,
    .value h4:first-of-type,
    .value h5:first-of-type {
      margin-top: 0;
    }

    .value p:last-of-type {
      margin-bottom: 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.#clearPartDataURLs();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#clearPartDataURLs();
  }

  #clearPartDataURLs() {
    for (const url of this.#partDataURLs.values()) {
      console.info(`Revoking ${url}`);
      URL.revokeObjectURL(url);
    }

    this.#partDataURLs.clear();
  }

  render() {
    return this.value && this.value.parts.length
      ? html`${map(this.value.parts, (part, idx) => {
          let value: TemplateResult | symbol = nothing;
          if (isText(part)) {
            value = html`${markdown(part.text)}`;
          } else if (isInlineData(part)) {
            const key = idx;
            let partDataURL: Promise<string> = Promise.resolve("No source");
            if (this.#partDataURLs.has(key)) {
              partDataURL = Promise.resolve(this.#partDataURLs.get(key)!);
            } else if (
              part.inlineData.data !== "" &&
              !part.inlineData.mimeType.startsWith("text")
            ) {
              const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              partDataURL = fetch(dataURL)
                .then((response) => response.blob())
                .then((data) => {
                  const url = URL.createObjectURL(data);
                  this.#partDataURLs.set(key, url);
                  return url;
                });
            }
            const tmpl = partDataURL.then((url: string) => {
              if (part.inlineData.mimeType.startsWith("image")) {
                return cache(html`<img src="${url}" alt="LLM Image" />`);
              }
              if (part.inlineData.mimeType.startsWith("audio")) {
                return cache(html`<audio src="${url}" controls />`);
              }
              if (part.inlineData.mimeType.startsWith("video")) {
                return cache(html`<video src="${url}" controls />`);
              }
              if (part.inlineData.mimeType.startsWith("text")) {
                return cache(
                  // prettier-ignore
                  html`<div class="plain-text">${atob(part.inlineData.data)}</div>`
                );
              }
            });
            value = html`${until(tmpl)}`;
          } else if (isFunctionCall(part) || isFunctionResponse(part)) {
            value = html` <bb-json-tree .json=${part}></bb-json-tree>`;
          } else if (isStoredData(part)) {
            const storedData = this.dataStore?.instance?.retrieveAsURL(part);
            if (!storedData) {
              value = html`<div>Failed to retrieve stored data</div>`;
            } else {
              const tmpl = storedData.then((url) => {
                const { mimeType } = part.storedData;
                const getData = async () => {
                  const response = await fetch(url);
                  return response.text();
                };
                if (mimeType.startsWith("image")) {
                  return html`<img src="${url}" alt="LLM Image" />`;
                }
                if (mimeType.startsWith("audio")) {
                  return html`<audio src="${url}" controls />`;
                }
                if (mimeType.startsWith("video")) {
                  return html`<video src="${url}" controls />`;
                }
                if (mimeType.startsWith("text")) {
                  return html`<div class="plain-text">
                    ${until(getData())}
                  </div>`;
                }
              });
              value = html`${until(tmpl)}`;
            }
          } else {
            value = html`Unrecognized part`;
          }
          return html`<div class="content">
            <span class="value">${value}</span>
          </div>`;
        })}`
      : html`No data set`;
  }
}
