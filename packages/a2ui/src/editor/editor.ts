/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { A2UIClient } from "./client";
import {
  LitElement,
  html,
  css,
  nothing,
  TemplateResult,
  HTMLTemplateResult,
} from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { A2UIModelProcessor } from "../0.8/data/model-processor";
import { A2UIProtocolMessage, Theme } from "../0.8/types/types";
import { repeat } from "lit/directives/repeat.js";
import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { themeContext } from "../0.8/ui/context/theme";
import { theme as uiTheme } from "./theme/theme.js";
import "./ui/ui.js";
import * as UI from "../0.8/ui/ui.js";
import { classMap } from "lit/directives/class-map.js";
import { Snackbar } from "./ui/snackbar.js";
import { ref } from "lit/directives/ref.js";
import {
  SnackbarAction,
  SnackbarMessage,
  SnackbarUUID,
  SnackType,
} from "./types/types.js";
import { DrawableCanvas } from "./ui/ui.js";

type Mode = "upload" | "sketch";

@customElement("a2ui-layout-editor")
export class A2UILayoutEditor extends SignalWatcher(LitElement) {
  @provide({ context: themeContext })
  accessor theme: Theme = uiTheme;

  @state()
  accessor #ready = false;

  @state()
  accessor #requesting = false;

  @state()
  accessor #processingImage = false;

  @state()
  accessor #draggingImage = false;

  @state()
  accessor #image: HTMLImageElement | null = null;

  #snackbar: Snackbar | undefined = undefined;
  #pendingSnackbarMessages: Array<{
    message: SnackbarMessage;
    replaceAll: boolean;
  }> = [];

  @query("drawable-canvas")
  accessor #drawableCanvas: DrawableCanvas | null = null;

  static styles = [
    UI.Styles.all,
    css`
      :host {
        display: grid;
        width: 100%;
        height: 100%;
        color: var(--text-color);
        grid-template-rows: 42px 1fr;
      }

      header {
        border-bottom: 1px solid var(--border-color);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      }

      .rotate {
        animation: rotate 1s linear infinite;
      }

      .g-icon.large {
        font-size: 100px;
      }

      h1,
      h2 {
        display: flex;
        align-items: center;
        margin: 0;

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
        }
      }

      @media (min-height: 960px) {
        #main #controls-container {
          grid-template-rows: 32px 62px 1fr 102px 42px;
          gap: var(--bb-grid-size-5);

          & #controls {
            margin-bottom: var(--bb-grid-size-3);
          }
        }
      }

      #main {
        & ui-splitter {
          height: 100%;
        }

        & #controls-container {
          padding: var(--bb-grid-size-6);
          display: grid;
          grid-template-rows: 32px 52px 1fr 102px 42px;
          gap: var(--bb-grid-size-3);

          & #controls {
            display: flex;
            align-items: end;
            margin-bottom: var(--bb-grid-size-3);

            & button {
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 1;
              min-height: 42px;
              padding: 0;
              border: none;
              background: none;
              color: var(--text-color);
              opacity: 0.5;
              border-bottom: 2px solid var(--border-color);
              transition:
                opacity 0.3s cubic-bezier(0, 0, 0.3, 1),
                border-color 0.3s cubic-bezier(0, 0, 0.3, 1);

              &:not([disabled]):not(.active) {
                cursor: pointer;
              }

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }

              &.active {
                opacity: 1;
                border-bottom: 2px solid var(--primary);
              }
            }
          }

          & #upload,
          & #sketch {
            display: none;
            border-radius: var(--bb-grid-size-2);
            border: 1px dashed var(--border-color);
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: var(--elevated-background-light);
            text-align: center;
            gap: var(--bb-grid-size-4);
            overflow: scroll;
            scrollbar-width: none;

            > * {
              max-width: calc(100% - var(--bb-grid-size-8));
              color: var(--n-60);
              max-height: calc(100% - var(--bb-grid-size-8));
              margin: var(--bb-grid-size-4);
              pointer-events: none;
            }

            > drawable-canvas {
              border-radius: var(--bb-grid-size);
              pointer-events: auto;
            }

            > #img {
              position: relative;
              pointer-events: auto;

              &:hover {
                & button {
                  display: flex;
                }
              }

              & button {
                display: none;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: 50%;
                background: var(--primary);
                color: var(--text-color);
                width: 70px;
                height: 70px;
                position: absolute;
                top: 50%;
                left: 50%;
                translate: -50% -50%;
                padding: 0;

                & .g-icon {
                  font-size: 40px;
                }
              }

              & img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                border-radius: var(--bb-grid-size);
              }
            }

            &.active {
              display: flex;
            }

            & button {
              border-radius: var(--bb-grid-size-2);
              color: var(--primary);
              background: oklch(from var(--primary) l c h / calc(alpha * 0.2));
              opacity: 0.4;
              border: none;
              transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
              width: 100%;
              max-width: 420px;
              padding: var(--bb-grid-size-2) var(--bb-grid-size-5);
              pointer-events: auto;

              &:not([disabled]) {
                opacity: 1;
                cursor: pointer;
              }
            }
          }

          & textarea {
            border-radius: var(--bb-grid-size-2);
            border: 1px solid var(--border-color);
            padding: var(--bb-grid-size-2);
            color: var(--text-color);
            background: var(--elevated-background-light);
            resize: none;
          }

          & button[type="submit"] {
            border-radius: var(--bb-grid-size-2);
            color: var(--text-color);
            background: var(--primary);
            opacity: 0.4;
            border: none;
            transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
            width: 100%;
            max-width: 420px;
            justify-self: center;

            &:not([disabled]) {
              opacity: 1;
              cursor: pointer;
            }
          }
        }

        & #surface-container {
          padding: var(--bb-grid-size-6);
          border-left: 1px solid var(--border-color);
          display: grid;
          grid-template-rows: 32px 1fr;
          gap: var(--bb-grid-size-4);

          & #surfaces {
            display: flex;
            border-radius: var(--bb-grid-size-2);
            border: 1px dashed var(--border-color);
            align-items: center;
            justify-content: center;
            padding: var(--bb-grid-size-4);
            overflow: scroll;
            scrollbar-width: none;

            & a2ui-surface {
              width: 100%;
              max-width: 640px;
              max-height: 600px;
            }
          }

          & #generating-surfaces,
          & #no-surfaces {
            p {
              color: var(--n-60);
            }

            width: 50%;
            max-width: 400px;
            text-align: center;
          }

          & #generating-surfaces {
            & h2 {
              justify-content: center;
              white-space: nowrap;
            }
          }

          & #no-surfaces {
            & h2 {
              display: block;
              text-align: center;
            }
          }
        }
      }

      @keyframes rotate {
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
      }
    `,
  ];

  @state()
  set mode(mode: Mode) {
    this.#mode = mode;
    localStorage.setItem("ui-mode", mode);
  }
  get mode() {
    return this.#mode;
  }

  #mode: Mode = "upload";
  #processor = new A2UIModelProcessor();
  #a2uiClient = new A2UIClient();

  constructor() {
    super();

    this.#mode = (localStorage.getItem("ui-mode") as Mode) ?? "upload";
    this.#a2uiClient.ready.then(() => {
      this.#ready = true;
    });
  }

  async #processRequest(
    image?: HTMLImageElement | null,
    instructions?: string
  ): Promise<A2UIProtocolMessage[]> {
    try {
      this.#requesting = true;
      const response = await this.#a2uiClient.sendMultipart(
        image?.src,
        instructions
      );

      const message = JSON.parse(response.parts[0].text) as
        | A2UIProtocolMessage
        | A2UIProtocolMessage[];

      if (Array.isArray(message)) {
        return message;
      }

      return [message];
    } catch (err) {
      this.snackbar(err as string, SnackType.ERROR);
    } finally {
      this.#requesting = false;
    }

    return [];
  }

  #renderSurfaces() {
    if (this.#requesting) {
      return html`<section id="surfaces">
        <div id="generating-surfaces">
          <h2 class="typography-w-400 typography-f-s typography-sz-tl">
            <span class="g-icon filled round rotate">progress_activity</span
            >Generating your UI
          </h2>
          <p class="typography-f-s typography-sz-bl">Working on it...</p>
        </div>
      </section>`;
    }

    const surfaces = this.#processor.getSurfaces();
    if (surfaces.size === 0) {
      return html`<section id="surfaces">
        <div id="no-surfaces">
          <h2 class="typography-w-400 typography-f-s typography-sz-tl">
            No UI Generated Yet
          </h2>
          <p class="typography-f-s typography-sz-bl">
            Describe your desired UI in the left panel and click 'Generate UI'
            to see the result here.
          </p>
        </div>
      </section>`;
    }

    return html`<section id="surfaces">
      ${repeat(
        this.#processor.getSurfaces(),
        ([id]) => id,
        ([, surface]) => {
          return html`<a2ui-surface
            .surface=${surface}
            .processor=${this.#processor}
          ></a2-uisurface>`;
        }
      )}
    </section>`;
  }

  #processImage(file: File) {
    this.#processingImage = true;

    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      this.#processingImage = false;
      const file = reader.result as string;
      if (!file.startsWith("data:image/")) {
        return;
      }

      this.#image = new Image();
      this.#image.src = file;
    });
    reader.addEventListener("error", () => {
      this.#processingImage = false;
    });
    reader.addEventListener("false", () => {
      this.#processingImage = false;
    });
    reader.readAsDataURL(file);
  }

  #renderInput() {
    const imageView = html`<div id="img">
      ${this.#image}
      <button
        @click=${() => {
          this.#image = null;
        }}
        type="button"
      >
        <span class="g-icon filled round">delete</span>
      </button>
    </div>`;

    const dragView = html` <div class="g-icon large filled round color-c-n50">
        check_circle
      </div>
      <p>Drop your image</p>`;

    const processingView = html`<p>
      <span class="g-icon filled round rotate color-c-n50"
        >progress_activity</span
      >Processing image...
    </p>`;

    const defaultView = html` <div class="g-icon large filled round upload">
        upload
      </div>
      <p>Drag &amp; drop an image here, or click upload</p>
      <div>
        <button
          class=${classMap({
            "typography-w-500": true,
            "typography-f-s": true,
            "typography-sz-bl": true,
          })}
          ?disabled=${this.#requesting}
          type="button"
          @click=${() => {
            const file = document.createElement("input");
            file.type = "file";
            file.accept = "image/*";
            file.click();

            file.addEventListener("input", () => {
              if (!file.files) {
                return;
              }

              this.#processImage(file.files[0]);
            });
          }}
        >
          Upload Image
        </button>
      </div>`;

    let view: TemplateResult | symbol = nothing;
    if (this.#draggingImage) {
      view = dragView;
    } else if (this.#processingImage) {
      view = processingView;
    } else if (this.#image) {
      view = imageView;
    } else {
      view = defaultView;
    }

    return html`
      <div id="controls">
        <button
          class=${classMap({
            active: this.mode === "upload",
            "typography-w-400": true,
            "typography-f-s": true,
            "typography-sz-tm": true,
          })}
          @click=${() => {
            this.mode = "upload";
          }}
          type="button"
        >
          <span class="g-icon filled round">upload</span>Upload
        </button>
        <button
          class=${classMap({
            active: this.mode === "sketch",
            "typography-w-400": true,
            "typography-f-s": true,
            "typography-sz-tm": true,
          })}
          @click=${() => {
            this.mode = "sketch";
          }}
          type="button"
        >
          <span class="g-icon filled round">draw</span>Sketch
        </button>
      </div>
      <div
        @dragstart=${(evt: Event) => {
          evt.preventDefault();
        }}
        @dragenter=${(evt: Event) => {
          evt.preventDefault();
          this.#draggingImage = true;
        }}
        @dragleave=${(evt: Event) => {
          evt.preventDefault();
          this.#draggingImage = false;
        }}
        @dragover=${(evt: Event) => {
          evt.preventDefault();
        }}
        @drop=${(evt: DragEvent) => {
          evt.preventDefault();
          this.#draggingImage = false;

          if (!evt.dataTransfer) {
            return;
          }

          if (evt.dataTransfer.files.length === 0) {
            return;
          }

          this.#processImage(evt.dataTransfer.files[0]);
        }}
        id="upload"
        class=${classMap({ active: this.mode === "upload" })}
      >
        ${view}
      </div>
      <div id="sketch" class=${classMap({ active: this.mode === "sketch" })}>
        <drawable-canvas></drawable-canvas>
      </div>
      <textarea
        name="instructions"
        class=${classMap({
          "typography-w-400": true,
          "typography-f-s": true,
          "typography-sz-bl": true,
        })}
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key !== "Enter" || evt.shiftKey) {
            return;
          }

          if (!(evt.target instanceof HTMLTextAreaElement)) {
            return;
          }

          evt.preventDefault();
          const form = evt.target.closest("form")!;
          form.dispatchEvent(new SubmitEvent("submit", { bubbles: true }));
        }}
        placeholder="Optional: Provide a text description with more details."
      ></textarea>
      <button
        ?disabled=${this.#requesting}
        class=${classMap({
          "typography-w-500": true,
          "typography-f-s": true,
          "typography-sz-bl": true,
        })}
        type="submit"
      >
        Generate UI
      </button>
    `;
  }

  #renderHeader() {
    return html`<header
      class="typography-w-400 typography-f-sf typography-sz-tm"
    >
      UI Generator
    </header>`;
  }

  #renderMain() {
    return html`<section id="main">
      <ui-splitter
        direction=${"horizontal"}
        name="layout-main"
        split="[0.20, 0.80]"
        .minSegmentSizeHorizontal=${325}
      >
        <form
          id="controls-container"
          slot="slot-0"
          @submit=${async (evt: SubmitEvent) => {
            evt.preventDefault();
            // TODO: Pull text & image data.
            const formData = new FormData(evt.target as HTMLFormElement);
            const instructions = formData.get("instructions");
            if (instructions === null) {
              return;
            }

            let img: HTMLImageElement | null = this.#image;
            if (this.mode === "sketch" && this.#drawableCanvas) {
              img = await this.#drawableCanvas.getValue();
            }

            const messages = await this.#processRequest(
              img,
              instructions as string
            );
            console.log(messages);
            this.#processor.clearSurfaces();
            this.#processor.processMessages(messages);
          }}
        >
          <h2 class="typography-w-400 typography-f-s typography-sz-tl">
            Describe your UI
          </h2>
          ${this.#renderInput()}
        </form>
        <div id="surface-container" slot="slot-1">
          <h2 class="typography-w-400 typography-f-s typography-sz-tl">
            Generated UI
          </h2>
          ${this.#renderSurfaces()}
        </div>
      </ui-splitter>
    </section>`;
  }

  #renderSnackbar() {
    return html`<ui-snackbar
      ${ref((el: Element | undefined) => {
        if (!el) {
          this.#snackbar = undefined;
        }

        this.#snackbar = el as Snackbar;
        for (const pendingMessage of this.#pendingSnackbarMessages) {
          const { message, id, persistent, type, actions } =
            pendingMessage.message;
          this.snackbar(message, type, actions, persistent, id);
        }

        this.#pendingSnackbarMessages.length = 0;
      })}
    ></ui-snackbar>`;
  }

  #renderUI() {
    return [this.#renderHeader(), this.#renderMain(), this.#renderSnackbar()];
  }

  snackbar(
    message: string | HTMLTemplateResult,
    type: SnackType,
    actions: SnackbarAction[] = [],
    persistent = false,
    id = globalThis.crypto.randomUUID(),
    replaceAll = false
  ) {
    if (!this.#snackbar) {
      this.#pendingSnackbarMessages.push({
        message: {
          id,
          message,
          type,
          persistent,
          actions,
        },
        replaceAll,
      });
      return;
    }

    return this.#snackbar.show(
      {
        id,
        message,
        type,
        persistent,
        actions,
      },
      replaceAll
    );
  }

  unsnackbar(id?: SnackbarUUID) {
    if (!this.#snackbar) {
      return;
    }

    this.#snackbar.hide(id);
  }

  render() {
    if (!this.#ready) {
      return html`Loading...`;
    }

    return this.#renderUI();
  }
}
