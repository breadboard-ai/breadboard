/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LLMContent } from "@breadboard-ai/types";
import {
  isFileDataCapabilityPart,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isInlineData,
  isJSONPart,
  isListPart,
  isLLMContent,
  isStoredData,
  isTextCapabilityPart,
} from "@google-labs/breadboard";
import {
  LitElement,
  PropertyValues,
  TemplateResult,
  css,
  html,
  nothing,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { cache } from "lit/directives/cache.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { until } from "lit/directives/until.js";
import { markdown } from "../../../directives/markdown.js";
import { ToastEvent, ToastType } from "../../../events/events.js";
import { appendToDocUsingDriveKit } from "../../google-drive/append-to-doc-using-drive-kit.js";
import { tokenVendorContext } from "../../elements.js";
import { consume } from "@lit/context";
import type { TokenVendor } from "@breadboard-ai/connection-client";
import "./export-toolbar.js";
import { styleMap } from "lit/directives/style-map.js";
import { getGlobalColor } from "../../../utils/color.js";
import {
  convertWatchUriToEmbedUri,
  isEmbedUri,
  isWatchUri,
} from "../../../utils/youtube.js";
import { SIGN_IN_CONNECTION_ID } from "../../../utils/signin-adapter.js";

const PCM_AUDIO = "audio/l16;codec=pcm;rate=24000";

@customElement("bb-llm-output")
export class LLMOutput extends LitElement {
  @property()
  accessor value: LLMContent | null = null;

  @property({ reflect: true, type: Boolean })
  accessor clamped = true;

  @property({ reflect: true, type: Boolean })
  accessor lite = false;

  @property()
  accessor showExportControls = false;

  @property()
  accessor supportedExportControls = { drive: false, clipboard: false };

  @property()
  accessor graphUrl: URL | null = null;

  @consume({ context: tokenVendorContext })
  accessor tokenVendor!: TokenVendor;

  #partDataURLs = new Map<number, string>();

  static styles = css`
    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }

    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: relative;
      border: var(--output-border-width, 2px) solid
        var(--output-border-color, var(--bb-neutral-300));
      border-radius: var(--output-border-radius, var(--bb-grid-size));
      margin-bottom: var(--bb-grid-size-2);
      background: var(--output-background-color, transparent);
    }

    :host([clamped]) {
      resize: vertical;
      overflow: auto;
      height: 200px;
      min-height: var(--bb-grid-size-6);
    }

    :host(:not([clamped])) {
      min-height: var(--output-min-height, 0);
    }

    :host([lite]) {
      border: 1px solid var(--output-lite-border-color, var(--bb-neutral-100));
      background: var(--output-lite-background-color, var(--bb-neutral-0));
    }

    .content {
      display: block;
      position: relative;
      margin-bottom: var(--bb-grid-size-2);
      padding: var(--output-padding-y, 0) var(--output-padding-x, 0);
      overflow-y: auto;
      max-height: var(--bb-llm-output-content-max-height, unset);
    }

    .content:last-of-type {
      margin-bottom: 0;
    }

    .value {
      display: flex;
      flex-direction: column;
      position: relative;

      margin: var(--output-value-margin-y, 0) var(--output-value-margin-x, 0);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);

      padding: var(--output-value-padding-y, 0) var(--output-value-padding-x, 0);

      white-space: normal;
      border-radius: initial;
      user-select: text;

      &:has(> img),
      &:has(> .copy-image-to-clipboard),
      &:has(> video),
      &:has(> audio) {
        justify-content: center;
        align-items: center;
        padding: var(--output-value-padding-y, 0)
          var(--output-value-padding-x, 0);
      }

      &:has(> .html-view) {
        padding: 0;
        margin: 0;
      }

      & pre {
        font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
      }

      & iframe {
        aspect-ratio: 16/9;
        margin: 0;
      }

      & .empty-text-part {
        margin: 0;
        padding: 0;
        border-radius: var(--bb-grid-size-16);
        font: normal italic var(--bb-body-small) /
          var(--bb-body-line-height-small) var(--bb-font-family);
      }
    }

    .value img,
    .value video,
    .value audio {
      width: 100%;
      max-width: 360px;
    }

    .value img,
    .value video,
    iframe.html-view {
      border-radius: var(--output-border-radius);
    }

    iframe.html-view {
      border: none;
      width: 100%;
      overflow-x: auto;
      height: 600px;
    }

    .value .plain-text {
      white-space: pre;
      font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
      color: var(--bb-neutral-900);
    }

    .value.markdown {
      line-height: 1.5;
      overflow-x: auto;
      color: var(--bb-neutral-900);

      & a {
        color: var(--primary-color, var(--bb-ui-700));
      }
    }

    .value * {
      margin: 0;
    }

    .value h1 {
      font: 500 var(--bb-title-large) / var(--bb-title-line-height-large)
        var(--bb-font-family);

      margin: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
    }

    .value h2 {
      font: 500 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);

      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
    }

    .value h3,
    .value h4,
    .value h5 {
      font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);

      margin: var(--bb-grid-size-3) 0 var(--bb-grid-size-2) 0;
    }

    .value p {
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);

      margin: 0 0 var(--bb-grid-size-2) 0;
      white-space: pre-line;

      & strong:only-child {
        margin: var(--bb-grid-size-2) 0 0 0;
      }
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

    :host([lite]) .value {
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

    .copy-image-to-clipboard {
      position: relative;

      & button {
        width: 32px;
        height: 32px;
        background: var(--background-color, var(--bb-neutral-0))
          var(--bb-icon-copy-to-clipboard) center center / 20px 20px no-repeat;
        position: absolute;
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        border-radius: 50%;
        cursor: pointer;
        border: 1px solid var(--bb-neutral-300);
        font-size: 0;
        opacity: 0;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
      }

      &:hover button {
        opacity: 1;
      }
    }

    bb-export-toolbar {
      display: none;
      position: absolute;
      top: -16px;
      right: var(--export-x, 16px);
      z-index: 1;
      animation: fadeIn 0.15s cubic-bezier(0, 0, 0.3, 1);
    }

    bb-pdf-viewer {
      aspect-ratio: 1/1;
    }

    :host(:hover) {
      bb-export-toolbar {
        display: block;
      }
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

  #renderableParts = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("value")) {
      this.#clearPartDataURLs();

      if (this.value !== null && !isLLMContent(this.value)) {
        console.warn("Received unexpected value for LLM output", this.value);
        this.#renderableParts = 0;
        return;
      }

      this.#renderableParts = this.value?.parts.length ?? 0;
    }
  }

  protected updated(_changedProperties: PropertyValues): void {
    this.#dispatchIfAllLoaded();
  }

  #outputLoaded() {
    this.#renderableParts--;
    this.#dispatchIfAllLoaded();
  }

  #dispatchIfAllLoaded() {
    if (this.#renderableParts > 0) {
      return;
    }

    this.dispatchEvent(new Event("outputsloaded"));
  }

  render() {
    const canCopy = this.showExportControls && "ClipboardItem" in window;
    if (this.value && !isLLMContent(this.value)) {
      console.warn(`Unexpected value for LLM Output`, this.value);
      return nothing;
    }

    return this.value && this.value.parts.length
      ? html` ${this.showExportControls
          ? html`<bb-export-toolbar
              .supported=${this.supportedExportControls}
              .value=${this.value}
              .graphUrl=${this.graphUrl}
            ></bb-export-toolbar>`
          : nothing}
        ${map(this.value.parts, (part, idx) => {
          let value: TemplateResult | symbol = nothing;
          if (isTextCapabilityPart(part)) {
            if (part.text === "") {
              value = html`<span class="empty-text-part">
                No value provided
              </span>`;
            } else {
              value = html`${markdown(part.text)}`;
            }

            this.#outputLoaded();
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
                return cache(html`
                  ${canCopy && part.inlineData.mimeType === "image/png"
                    ? html` <div class="copy-image-to-clipboard">
                        <img
                          @load=${() => {
                            this.#outputLoaded();
                          }}
                          src="${url}"
                          alt="LLM Image"
                        />
                        <button
                          @click=${async () => {
                            const data = await fetch(url);
                            const imageData = await data.blob();

                            await navigator.clipboard.write([
                              new ClipboardItem({
                                [part.inlineData.mimeType]: imageData,
                              }),
                            ]);

                            this.dispatchEvent(
                              new ToastEvent(
                                "Copied image to Clipboard",
                                ToastType.INFORMATION
                              )
                            );
                          }}
                        >
                          Copy image to clipboard
                        </button>
                      </div>`
                    : html`<img
                        @load=${() => {
                          this.#outputLoaded();
                        }}
                        src="${url}"
                        alt="LLM Image"
                      />`}
                `);
              }
              if (part.inlineData.mimeType.startsWith("audio")) {
                const audioHandler = fetch(url)
                  .then((r) => r.blob())
                  .then((data) => {
                    if (
                      part.inlineData.mimeType.toLocaleLowerCase() === PCM_AUDIO
                    ) {
                      return new Blob([data], { type: PCM_AUDIO });
                    }

                    return data;
                  })
                  .then((audioFile) => {
                    const colorLight =
                      this.value?.role === "model"
                        ? getGlobalColor("--bb-generative-400")
                        : getGlobalColor("--bb-ui-400");
                    const colorMid =
                      this.value?.role === "model"
                        ? getGlobalColor("--bb-generative-500")
                        : getGlobalColor("--bb-ui-500");
                    const colorDark =
                      this.value?.role === "model"
                        ? getGlobalColor("--bb-generative-600")
                        : getGlobalColor("--bb-ui-600");

                    this.#outputLoaded();
                    return cache(
                      html`<div class="play-audio-container">
                        <bb-audio-handler
                          .audioFile=${audioFile}
                          .color=${colorLight}
                          style=${styleMap({
                            "--color-button": colorMid,
                            "--color-button-active": colorDark,
                          })}
                        ></bb-audio-handler>
                      </div>`
                    );
                  });

                return cache(html`${until(audioHandler)}`);
              }
              if (part.inlineData.mimeType.startsWith("text/html")) {
                this.#outputLoaded();
                return cache(
                  html`<iframe
                    srcdoc="${part.inlineData.data}"
                    frameborder="0"
                    class="html-view"
                  ></iframe>`
                );
              }
              if (part.inlineData.mimeType.startsWith("video")) {
                return cache(
                  html`<video
                    @load=${() => {
                      this.#outputLoaded();
                    }}
                    src="${url}"
                    controls
                  />`
                );
              }
              if (part.inlineData.mimeType.startsWith("text")) {
                return cache(
                  // prettier-ignore
                  html`<div class="plain-text">${atob(part.inlineData.data)}</div>`
                );
              }
              if (part.inlineData.mimeType === "application/pdf") {
                const pdfHandler = fetch(url)
                  .then((r) => r.arrayBuffer())
                  .then((pdfData) => {
                    this.#outputLoaded();
                    return cache(
                      html`<bb-pdf-viewer
                        .showControls=${true}
                        .data=${pdfData}
                      ></bb-pdf-viewer>`
                    );
                  });

                return cache(html`${until(pdfHandler)}`);
              }
            });
            value = html`${until(tmpl)}`;
          } else if (
            isFunctionCallCapabilityPart(part) ||
            isFunctionResponseCapabilityPart(part)
          ) {
            this.#outputLoaded();
            value = html` <bb-json-tree .json=${part}></bb-json-tree>`;
          } else if (isStoredData(part)) {
            let url = part.storedData.handle;
            if (!url) {
              this.#outputLoaded();
              value = html`<div>Failed to retrieve stored data</div>`;
            } else {
              const { mimeType } = part.storedData;
              if (url.startsWith(".") && this.graphUrl) {
                url = new URL(url, this.graphUrl).href;
              }
              const getData = async () => {
                const response = await fetch(url);
                return response.text();
              };
              if (mimeType.startsWith("image")) {
                value = html`<img
                  @load=${() => {
                    this.#outputLoaded();
                  }}
                  src="${url}"
                  alt="LLM Image"
                />`;
              }
              if (mimeType.startsWith("audio")) {
                value = html`<audio
                  @loadedmetadata=${() => {
                    this.#outputLoaded();
                  }}
                  src="${url}"
                  controls
                />`;
              }
              if (mimeType.startsWith("video")) {
                value = html`<video
                  @loadedmetadata=${() => {
                    this.#outputLoaded();
                  }}
                  src="${url}"
                  controls
                />`;
              }
              if (mimeType.startsWith("text")) {
                this.#outputLoaded();
                if (mimeType === "text/html") {
                  this.#outputLoaded();
                  value = html`<iframe
                    srcdoc="${until(getData())}"
                    frameborder="0"
                    class="html-view"
                  ></iframe>`;
                } else {
                  value = html`<div class="plain-text">
                    ${until(getData())}
                  </div>`;
                }
              }
              if (part.storedData.mimeType === "application/pdf") {
                const pdfHandler = fetch(url)
                  .then((r) => r.arrayBuffer())
                  .then((pdfData) => {
                    this.#outputLoaded();
                    return cache(
                      html`<bb-pdf-viewer
                        .showControls=${true}
                        .data=${pdfData}
                      ></bb-pdf-viewer>`
                    );
                  });

                value = html`${until(pdfHandler)}`;
              }
            }
          } else if (isFileDataCapabilityPart(part)) {
            switch (part.fileData.mimeType) {
              case "video/mp4": {
                if (part.fileData.fileUri === "") {
                  value = html`<span class="empty-text-part">
                    YouTube video URL not set
                  </span>`;
                } else {
                  let uri: string | null = part.fileData.fileUri;
                  if (isWatchUri(uri)) {
                    uri = convertWatchUriToEmbedUri(uri);
                  } else if (!isEmbedUri(uri)) {
                    uri = null;
                  }

                  if (!isEmbedUri(uri)) {
                    value = html`<span class="empty-text-part">
                      Invalid YouTube Video URL
                    </span>`;
                    break;
                  }

                  value = html`<iframe
                    class="youtube-embed"
                    src="${uri}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen
                  ></iframe>`;
                }
                this.#outputLoaded();
                break;
              }

              default: {
                this.#outputLoaded();
                if (
                  part.fileData.mimeType.startsWith(
                    "application/vnd.google-apps"
                  )
                ) {
                  value = html`<bb-google-drive-file-viewer
                    .fileUri=${part.fileData.fileUri}
                    .mimeType=${part.fileData.mimeType}
                    .connectionName=${SIGN_IN_CONNECTION_ID}
                  ></bb-google-drive-file-viewer>`;
                  break;
                }

                value = html`Unrecognized item`;
                break;
              }
            }
          } else if (isJSONPart(part)) {
            this.#outputLoaded();
            value = html`<bb-json-tree .json=${part.json}></bb-json-tree>`;
          } else if (isListPart(part)) {
            this.#outputLoaded();
            value = html`${part.list
              .map((item) => {
                const content = item.content.at(-1);
                if (!content) return nothing;
                return html`<bb-llm-output
                  .showExportControls=${true}
                  .graphUrl=${this.graphUrl}
                  .lite=${true}
                  .clamped=${false}
                  .value=${content}
                ></bb-llm-output>`;
              })
              .filter((item) => item !== null)}`;
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

  async #onClickSaveToGoogleDriveButton() {
    if (!this.value) {
      console.error("Error saving to Google Drive: No value");
      return;
    }
    if (!this.tokenVendor) {
      console.error("Error saving to Google Drive: No token vendor");
      return;
    }
    const { url } = await appendToDocUsingDriveKit(
      this.value,
      `Breadboard Demo (${new Date().toLocaleDateString("en-US")})`,
      this.tokenVendor
    );
    this.dispatchEvent(
      new ToastEvent(
        // HACK: Toast messages are typed to only allow strings, but actually
        // they just directly render the value, so a TemplateResult works too,
        // letting us embed a link.
        html`Content saved to
          <a href=${url} target="_blank">Google Doc</a>` as unknown as string,
        ToastType.INFORMATION
      )
    );
  }
}
