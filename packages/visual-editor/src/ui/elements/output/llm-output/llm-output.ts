/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DataPart, LLMContent } from "@breadboard-ai/types";
import {
  isStoredData,
  Template,
  isNotebookLmUrl,
  parseNotebookLmId,
} from "@breadboard-ai/utils";
import {
  HTMLTemplateResult,
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
import { styleMap } from "lit/directives/style-map.js";
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  isEmbedUri,
  isShareUri,
  isShortsUri,
  isWatchUri,
} from "../../../../utils/media/youtube.js";

import { icons } from "../../../styles/icons.js";
import { OverflowAction } from "../../../types/types.js";
import { OverflowMenuActionEvent } from "../../../events/events.js";
import { partToDriveFileId } from "@breadboard-ai/utils/google-drive/utils.js";
import {
  isCodeExecutionResultPart,
  isExecutableCodePart,
  isFileDataCapabilityPart,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isInlineData,
  isJSONPart,
  isLLMContent,
  isTextCapabilityPart,
} from "../../../../data/common.js";
import "../../notebooklm-viewer/notebooklm-viewer.js";

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
  accessor showPDFControls = true;

  @property()
  accessor supportedExportControls = { drive: false, clipboard: false };

  @property()
  accessor graphUrl: URL | null = null;

  @property()
  accessor forceDrivePlaceholder = false;

  #partDataURLs = new Map<number, string>();

  static styles = [
    icons,
    css`
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
        margin-bottom: var(--bb-grid-size-2);
        background: var(--output-background-color, transparent);
        border-radius: var(--output-border-radius, 0);

        --md-h1-font: 500 var(--bb-title-large) /
          var(--bb-title-line-height-large) var(--bb-font-family);
        --md-h1-margin: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;

        --md-h2-font: 500 var(--bb-title-medium) /
          var(--bb-title-line-height-medium) var(--bb-font-family);
        --md-h2-margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;

        --md-h-font: 500 var(--bb-title-small) /
          var(--bb-title-line-height-small) var(--bb-font-family);
        --md-h-margin: var(--bb-grid-size-3) 0 var(--bb-grid-size-2) 0;

        --md-p-font: 400 var(--bb-body-medium) /
          var(--bb-body-line-height-medium) var(--bb-font-family);
        --md-p-margin: 0 0 var(--bb-grid-size-2) 0;
        --md-p-text-align: left;
        --md-color: var(--light-dark-n-10);
        --md-a-color: var(--primary-color, var(--light-dark-p-30));

        & .content {
          border-radius: var(--output-border-radius, var(--bb-grid-size));
        }
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
        & .content {
          background: var(
            --output-lite-background-color,
            light-dark(var(--n-100), var(--n-15))
          );

          &:has(.html-view) {
            border: none;
            border-radius: 0;

            --output-lite-border-color: transparent;
            --output-border-radius: 0;
          }
        }
      }

      .loading {
        display: flex;
        align-items: center;
        height: 20px;
        font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);

        &::before {
          content: "";
          width: 20px;
          height: 20px;
          background: url(/images/progress-ui.svg) center center / 20px 20px
            no-repeat;
          margin-right: var(--bb-grid-size-2);
        }
      }

      .content {
        display: block;
        position: relative;
        margin: 0 auto;
        margin-bottom: var(--bb-grid-size-2);
        padding: var(--output-padding-y, 0) var(--output-padding-x, 0);
        overflow-y: auto;
        max-height: var(--bb-llm-output-content-max-height, unset);

        &:last-of-type {
          margin-bottom: 0;
        }

        & .value {
          display: flex;
          flex-direction: column;
          position: relative;

          margin: var(--output-value-margin-y, 0)
            var(--output-value-margin-x, 0);
          font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
          color: var(--light-dark-n-10);

          padding: var(--output-value-padding-y, 0)
            var(--output-value-padding-x, 0);

          white-space: normal;
          border-radius: initial;
          user-select: text;

          .no-data {
            font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family-mono);
          }

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

          & * {
            margin: 0;
          }

          & img,
          & video,
          & audio {
            width: 100%;
            min-width: 300px;
            max-width: 540px;
          }

          & img,
          & video {
            border-radius: var(--output-border-radius);
          }

          & pre {
            font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family);
          }

          & .youtube-embed,
          bb-app-sandbox::part(iframe) {
            aspect-ratio: 16/9;
            margin: 0;
          }

          & .empty-text-part {
            color: var(--light-dark-n-10);
            margin: 0;
            padding: 0;
            border-radius: var(--bb-grid-size-16);
            font: normal italic var(--bb-body-small) /
              var(--bb-body-line-height-small) var(--bb-font-family);
          }

          & ol {
            margin-top: var(--bb-grid-size-2);

            & li {
              margin: var(--bb-grid-size-2);
            }
          }

          & .overflow {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            padding: 0;
            margin: 0;
            border: none;
            color: var(--light-dark-n-100);
            background: var(--light-dark-n-40);
            position: absolute;
            bottom: calc(
              var(--output-value-padding-y, 0) + var(--bb-grid-size-2)
            );
            right: calc(
              var(--output-value-padding-x, 0) + var(--bb-grid-size-2)
            );

            & .g-icon {
              pointer-events: none;
            }

            &:not([disabled]) {
              cursor: pointer;
            }
          }
        }

        & .plain-text {
          white-space: pre;
          font: 500 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family-mono);
          color: var(--light-dark-n-10);
        }

        & .markdown {
          line-height: 1.5;
          overflow-x: auto;
          color: var(--md-color);

          & a {
            color: var(--md-a-color);
          }

          h1 {
            font: var(--md-h1-font);
            margin: var(--md-h1-margin);
          }

          & h2 {
            font: var(--md-h2-font);
            margin: var(--md-h2-margin);
          }

          & h3,
          & h4,
          & h5 {
            font: var(--md-h-font);
            margin: var(--md-h-margin);
          }

          & h1:first-of-type,
          & h2:first-of-type,
          & h3:first-of-type,
          & h4:first-of-type,
          & h5:first-of-type {
            margin-top: 0;
          }

          & p {
            font: var(--md-p-font);
            margin: var(--md-p-margin);
            text-align: var(--md-p-text-align);
            white-space: pre-line;

            & strong:only-child {
              margin: var(--bb-grid-size-2) 0 0 0;
            }

            &:last-of-type {
              margin-bottom: 0;
            }
          }
        }
      }

      bb-app-sandbox::part(iframe) {
        height: var(--html-view-height, 100svh);
        max-height: calc(100cqh - var(--bb-grid-size-11));
      }

      :host([lite]) .value {
        margin: 0;
      }

      .play-audio {
        background: var(--light-dark-n-100) var(--bb-icon-sound) 6px 3px / 16px
          16px no-repeat;
        border-radius: 20px;
        color: var(--light-dark-n-10);
        border: 1px solid var(--light-dark-n-50);
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
          background: var(--background-color, var(--light-dark-n-100))
            var(--bb-icon-copy-to-clipboard) center center / 20px 20px no-repeat;
          position: absolute;
          top: 50%;
          left: 50%;
          translate: -50% -50%;
          border-radius: 50%;
          cursor: pointer;
          border: 1px solid var(--light-dark-n-90);
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

      bb-overflow-menu {
        position: absolute;
        top: auto;
        bottom: calc(var(--output-value-padding-y, 0) + var(--bb-grid-size-2));
        right: calc(var(--output-value-padding-x, 0) + var(--bb-grid-size-2));
      }
    `,
  ];

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

  #overflowMenuConfiguration = {
    idx: 0,
    y: 0,
  };

  @property()
  accessor showPartOverflowMenu = false;

  #hasOverflowMenu(part: DataPart): boolean {
    if (isInlineData(part)) {
      if (
        part.inlineData.mimeType.startsWith("image") &&
        part.inlineData.data !== ""
      ) {
        return true;
      }
      if (part.inlineData.mimeType.startsWith("text/html")) {
        return true;
      }
    } else if (isStoredData(part)) {
      if (part.storedData.mimeType.startsWith("image")) {
        return true;
      }

      if (part.storedData.mimeType.startsWith("text/html")) {
        return true;
      }
    }

    return false;
  }

  render() {
    if (this.value && !isLLMContent(this.value)) {
      console.warn(`Unexpected value for LLM Output`, this.value);
      return nothing;
    }

    let partOverflowMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showPartOverflowMenu && this.#overflowMenuConfiguration) {
      const actions: OverflowAction[] = [
        {
          title: "Download",
          name: "download",
          icon: "download",
        },
      ];

      partOverflowMenu = html`<bb-overflow-menu
        id="user-overflow"
        style=${styleMap({
          bottom: `${this.#overflowMenuConfiguration.y}px`,
        })}
        .actions=${actions}
        .disabled=${false}
        @bboverflowmenudismissed=${() => {
          this.showPartOverflowMenu = false;
        }}
        @bboverflowmenuaction=${async (actionEvt: OverflowMenuActionEvent) => {
          this.showPartOverflowMenu = false;
          actionEvt.stopImmediatePropagation();

          switch (actionEvt.action) {
            case "download": {
              const data =
                this.value?.parts[this.#overflowMenuConfiguration.idx];

              let downloadSuffix;
              let dataHref;
              if (isInlineData(data)) {
                downloadSuffix = data.inlineData.mimeType.split("/").at(-1);
                // inlineData.data is always base64-encoded.
                dataHref = `data:${data.inlineData.mimeType};base64,${data.inlineData.data}`;
              } else if (isStoredData(data)) {
                dataHref = data.storedData.handle;
                if (dataHref.startsWith(".") && this.graphUrl) {
                  dataHref = new URL(dataHref, this.graphUrl).href;
                }
                downloadSuffix = data.storedData.mimeType.split("/").at(-1);
              }

              if (!dataHref) {
                return;
              }

              const download = document.createElement("a");
              download.href = dataHref;
              download.download = `file-download.${downloadSuffix}`;
              download.click();
              break;
            }
          }
        }}
      ></bb-overflow-menu>`;
    }
    return this.value && this.value.parts.length
      ? html`${map(this.value.parts, (part, idx) => {
          let value: TemplateResult | symbol = nothing;
          if (isTextCapabilityPart(part)) {
            if (part.text === "") {
              if (this.value?.parts.length === 1) {
                value = html`<span class="empty-text-part"
                  >No value provided</span
                >`;
              } else {
                return nothing;
              }
            } else {
              // We may receive outputs with chiclets in so we must scrub those.
              const tmpl = new Template(part.text);
              value = html`${markdown(tmpl.preview)}`;
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
            } else if (
              part.inlineData.data === "" &&
              !part.inlineData.mimeType.startsWith("text")
            ) {
              partDataURL = Promise.resolve("");
            }

            const tmpl = partDataURL.then((url: string) => {
              if (
                part.inlineData.mimeType.startsWith("image") &&
                (part.inlineData.mimeType === "image/png" ||
                  part.inlineData.mimeType === "image/jpeg")
              ) {
                if (part.inlineData.data === "") {
                  this.#outputLoaded();
                  return html`No image provided`;
                }

                return cache(html`
                  <img
                    @load=${() => {
                      this.#outputLoaded();
                    }}
                    src="${url}"
                    alt="LLM Image"
                  />
                `);
              }
              if (part.inlineData.mimeType.startsWith("audio")) {
                return cache(
                  html`<audio
                    @loadedmetadata=${() => {
                      this.#outputLoaded();
                    }}
                    src="${url}"
                    controls
                  />`
                );
              }
              if (part.inlineData.mimeType.startsWith("text/html")) {
                this.#outputLoaded();
                return cache(html`
                  <bb-app-sandbox
                    .srcdoc=${atob(part.inlineData.data)}
                    .graphUrl=${this.graphUrl?.href ?? ""}
                  ></bb-app-sandbox>
                `);
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
                // Decode inline base64 directly to ArrayBuffer — can't fetch
                // blob URLs under the app's CSP.
                const binary = atob(part.inlineData.data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                return html`<bb-pdf-viewer
                  @load=${() => {
                    this.#outputLoaded();
                  }}
                  .showControls=${this.showPDFControls}
                  .data=${bytes.buffer}
                ></bb-pdf-viewer>`;
              }
            });
            value = html`${until(tmpl)}`;
          } else if (
            isFunctionCallCapabilityPart(part) ||
            isFunctionResponseCapabilityPart(part) ||
            isExecutableCodePart(part) ||
            isCodeExecutionResultPart(part)
          ) {
            this.#outputLoaded();
            value = html` <bb-json-tree .json=${part}></bb-json-tree>`;
          } else if (isStoredData(part)) {
            let url = part.storedData.handle;
            if (!url) {
              this.#outputLoaded();
              value = html`<div>Failed to retrieve stored data</div>`;
            } else if (isNotebookLmUrl(url)) {
              // NotebookLM reference - extract notebook ID and render viewer
              const notebookId = parseNotebookLmId(url) ?? "";
              this.#outputLoaded();
              value = html`<bb-notebooklm-viewer
                .notebookId=${notebookId}
                .showExternalLink=${true}
              ></bb-notebooklm-viewer>`;
            } else {
              const fileId = partToDriveFileId(part);
              if (fileId) {
                this.#outputLoaded();

                value = html`<bb-google-drive-file-viewer
                  .fileId=${fileId}
                  .forcePlaceholder=${this.forceDrivePlaceholder}
                ></bb-google-drive-file-viewer>`;
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
                  const imgData = new Promise((resolve) => {
                    const image = new Image();
                    image.setAttribute("alt", url);
                    image.onload = () => {
                      this.#outputLoaded();
                      resolve(image);
                    };
                    image.onerror = () => {
                      this.#outputLoaded();
                      resolve(
                        html`<span class="empty-text-part"
                          >No image provided</span
                        >`
                      );
                    };
                    image.src = url;
                  });
                  value = html`${until(imgData)}`;
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
                  if (mimeType === "text/html") {
                    this.#outputLoaded();
                    value = html`
                      <bb-app-sandbox
                        .srcdoc=${until(getData())}
                        .graphUrl=${this.graphUrl?.href ?? ""}
                      ></bb-app-sandbox>
                    `;
                  } else {
                    this.#outputLoaded();
                    // prettier-ignore
                    value = html`<div class="plain-text">${until(getData())}</div>`;
                  }
                }
                if (part.storedData.mimeType === "application/pdf") {
                  value = html`<bb-pdf-viewer
                    @load=${() => {
                      this.#outputLoaded();
                    }}
                    .showControls=${this.showPDFControls}
                    .url=${url}
                  ></bb-pdf-viewer>`;
                }
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
                  if (isWatchUri(uri) || isShortsUri(uri)) {
                    uri = convertWatchOrShortsUriToEmbedUri(uri);
                  } else if (isShareUri(uri)) {
                    uri = convertShareUriToEmbedUri(uri);
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

                const fileId = partToDriveFileId(part);
                if (fileId) {
                  value = html`<bb-google-drive-file-viewer
                    .fileId=${fileId}
                    .forcePlaceholder=${this.forceDrivePlaceholder}
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
          } else {
            value = html`Unrecognized part`;
          }

          return html`<div class="content">
            <span
              class=${classMap({
                value: true,
                markdown: isTextCapabilityPart(part),
              })}
              >${value}
              ${this.#hasOverflowMenu(part) && this.showExportControls
                ? html`<button
                    class="overflow"
                    @click=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLButtonElement)) {
                        return;
                      }

                      const outerBounds = this.getBoundingClientRect();
                      const buttonBounds = evt.target.getBoundingClientRect();
                      const bottom = outerBounds.bottom - buttonBounds.bottom;

                      this.#overflowMenuConfiguration.idx = idx;
                      this.#overflowMenuConfiguration.y =
                        bottom + buttonBounds.height + 4;
                      this.showPartOverflowMenu = true;
                    }}
                  >
                    <span class="g-icon filled round">more_vert</span>
                  </button>`
                : nothing}
            </span>
          </div>`;
        })}
        ${partOverflowMenu}`
      : html`<span class="value no-data">No data set</span>`;
  }
}
