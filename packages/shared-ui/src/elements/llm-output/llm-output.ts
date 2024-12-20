/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LLMContent } from "@breadboard-ai/types";
import {
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import { LitElement, TemplateResult, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { cache } from "lit/directives/cache.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../directives/markdown.js";

@customElement("bb-llm-output")
export class LLMOutput extends LitElement {
  @property()
  value: LLMContent | null = null;

  @property({ reflect: true })
  clamped = true;

  @property({ reflect: true })
  lite = false;

  #partDataURLs = new Map<number, string>();

  static styles = css`
    :host {
      display: block;
      border: 2px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      padding: var(--bb-grid-size-3) 0;
      margin-bottom: var(--bb-grid-size-2);
    }

    :host([clamped="true"]) {
      resize: vertical;
      overflow: auto;
      height: 200px;
      min-height: var(--bb-grid-size-6);
    }

    :host([lite="true"]) {
      border: 1px solid var(--bb-ui-100);
      background: var(--bb-ui-50);
    }

    .content {
      display: block;
      margin-bottom: var(--bb-grid-size-2);
    }

    .content:last-of-type {
      margin-bottom: 0;
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
      border-radius: initial;
      user-select: text;
    }

    .value img,
    .value video,
    .value audio {
      width: 100%;
      max-width: 320px;
    }

    .value img,
    .value video,
    iframe.html-view {
      outline: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    iframe.html-view {
      border: none;
      width: 100%;
      height: 600px;
    }

    .value .plain-text {
      white-space: pre;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
      color: var(--bb-neutral-600);
    }

    .value.markdown {
      line-height: 1.5;
    }

    .value * {
      margin: var(--bb-grid-size) 0;
    }

    .value h1 {
      font-size: var(--bb-title-large);
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
    }

    .value h2 {
      font-size: var(--bb-title-medium);
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
    }

    .value h3,
    .value h4,
    .value h5 {
      font-size: var(--bb-title-small);
      margin: 0 0 var(--bb-grid-size-3) 0;
    }

    .value p {
      font-size: var(--bb-body-medium);
      margin: 0 0 var(--bb-grid-size-3) 0;
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

    .value.no-data {
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
    }

    :host([lite="true"]) .value {
      margin: 0;
    }

    .play-audio {
      background: var(--bb-neutral-0) var(--bb-icon-sound) 6px 3px / 16px 16px
        no-repeat;
      border-radius: 20px;
      color: var(--bb-neutral-900);
      border: 1px solid var(--bb-neutral-600);
      height: 24px;
      padding: 0 16px 0 28px;
      cursor: pointer;
      opacity: 0.5;
    }

    .play-audio:hover,
    .play-audio:focus {
      opacity: 1;
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
      URL.revokeObjectURL(url);
    }

    this.#partDataURLs.clear();
  }

  // TODO: Store this value rather than converting it on the fly.
  async #convertToAudioBuffer(url: string) {
    const TO_FLOAT = 32768;
    const sampleRate = 24000;
    const audio = await fetch(url);
    const arrayBuffer = await audio.arrayBuffer();
    const audioDataIn = new Int16Array(arrayBuffer);
    const audioDataOut = new Float32Array(audioDataIn.length);

    const duration = audioDataOut.length / sampleRate;
    const audioCtx = new OfflineAudioContext({
      length: audioDataOut.length,
      sampleRate,
    });

    const audioBuffer = audioCtx.createBuffer(
      1,
      sampleRate * duration,
      sampleRate
    );

    for (let i = 0; i < audioDataIn.length; i++) {
      audioDataOut[i] = audioDataIn[i] / TO_FLOAT;
    }

    audioBuffer.copyToChannel(audioDataOut, 0);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();

    return audioCtx.startRendering();
  }

  render() {
    return this.value && this.value.parts.length
      ? html`${map(this.value.parts, (part, idx) => {
          let value: TemplateResult | symbol = nothing;
          if (isTextCapabilityPart(part)) {
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
                if (
                  part.inlineData.mimeType === "audio/L16;codec=pcm;rate=24000"
                ) {
                  return this.#convertToAudioBuffer(url).then((buffer) => {
                    return cache(
                      html`<div class="play-audio-container">
                        <button
                          class="play-audio"
                          @click=${() => {
                            const audioCtx = new AudioContext({
                              sampleRate: 24000,
                            });
                            const source = audioCtx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioCtx.destination);
                            source.start();
                          }}
                        >
                          Play audio
                        </button>
                      </div>`
                    );
                  });
                }
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
          } else if (
            isFunctionCallCapabilityPart(part) ||
            isFunctionResponseCapabilityPart(part)
          ) {
            value = html` <bb-json-tree .json=${part}></bb-json-tree>`;
          } else if (isStoredData(part)) {
            const url = part.storedData.handle;
            if (!url) {
              value = html`<div>Failed to retrieve stored data</div>`;
            } else {
              const { mimeType } = part.storedData;
              const getData = async () => {
                const response = await fetch(url);
                return response.text();
              };
              if (mimeType.startsWith("image")) {
                value = html`<img src="${url}" alt="LLM Image" />`;
              }
              if (mimeType.startsWith("audio")) {
                value = html`<audio src="${url}" controls />`;
              }
              if (mimeType.startsWith("video")) {
                value = html`<video src="${url}" controls />`;
              }
              if (mimeType.startsWith("text")) {
                value = html`<div class="plain-text">${until(getData())}</div>`;
              }
            }
          } else {
            value = html`Unrecognized part`;
          }
          return html`<div class="content">
            <span
              class=${classMap({
                value: true,
                markdown: isTextCapabilityPart(part),
              })}
              >${value}</span
            >
          </div>`;
        })}`
      : html`<span class="value no-data">No data set</span>`;
  }
}
