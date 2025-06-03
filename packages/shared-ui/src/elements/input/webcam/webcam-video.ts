/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { icons } from "../../../styles/icons";

@customElement("bb-webcam-video-input")
export class WebcamVideoInput extends LitElement {
  @property()
  accessor type = "";

  @state()
  accessor error = "";

  @state()
  accessor #capturing = false;

  @state()
  accessor #value: string | null = null;

  static styles = [
    icons,
    css`
      :host {
        display: block;
        width: 100%;
        background-color: var(
          --bb-input-background-color,
          var(--default-bb-input-background-color)
        );
        border-radius: var(--bb-grid-size-2);
        aspect-ratio: 4/3;
        outline: 1px solid var(--bb-outline, var(--default-bb-outline));
      }

      section {
        display: grid;
        grid-template-rows: 1fr var(--bb-grid-size-8);
        align-items: center;
        row-gap: var(--bb-grid-size-2);

        & #controls {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }

      button {
        display: flex;
        align-items: center;
        height: var(--bb-grid-size-8);
        border-radius: var(--bb-grid-size-16);
        background: var(--n-90, var(--bb-neutral-100)) 8px center / 20px 20px
          no-repeat;
        color: var(--n-40, var(--bb-neutral-800));
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        border: none;
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-2);
        border: none;
        opacity: 0.6;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

        > .g-icon {
          pointer-events: none;
          margin-right: var(--bb-grid-size-2);
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }

        &#stop {
          animation: pulse linear 1s infinite forwards;
        }
      }

      canvas,
      video {
        display: block;
        width: 100%;
        border-radius: var(--bb-grid-size-2);
      }

      @keyframes pulse {
        0% {
          opacity: 0.2;
        }

        50% {
          opacity: 1;
        }

        100% {
          opacity: 0.2;
        }
      }
    `,
  ];

  #stream: MediaStream | null = null;
  #recorder: MediaRecorder | null = null;
  #blobs: Blob[] = [];
  #renderableValue: string | null = null;
  #showRecordButton = false;
  #preview = document.createElement("video");
  #width = 0;
  #height = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.#clearValues();
    this.#startStream();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#clearValues();
    this.#stopStream();
    this.#capturing = false;
  }

  get value() {
    if (!this.#value) {
      throw new Error("No value available - nothing recorded");
    }

    const preamble = `data:${this.type};base64,`;
    return this.#value.substring(preamble.length);
  }

  #clearValues() {
    this.#blobs.length = 0;
    this.#value = null;
    if (this.#renderableValue) {
      URL.revokeObjectURL(this.#renderableValue);
    }
  }

  async #startStream() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    this.#stream = stream;

    this.#preview.autoplay = true;
    this.#preview.addEventListener(
      "loadeddata",
      () => {
        this.#width = this.#preview.videoWidth;
        this.#height = this.#preview.videoHeight;
        this.#preview.muted = true;
      },
      { once: true }
    );

    this.#preview.muted = false;
    this.#preview.srcObject = this.#stream;
    this.#capturing = true;
  }

  #stopStream() {
    if (!this.#stream) {
      return;
    }

    for (const track of this.#stream.getTracks()) {
      track.stop();
      this.#stream.removeTrack(track);
    }

    this.#stream = null;
  }

  async record() {
    if (!this.#stream) {
      await this.#startStream();
    }

    if (!this.#stream) {
      return;
    }

    if (this.#recorder) {
      this.stop();
    }

    this.#clearValues();
    this.#recorder = new MediaRecorder(this.#stream);
    this.#recorder.ondataavailable = (evt) => {
      this.#blobs.push(evt.data);

      if (this.#recorder?.state !== "inactive") {
        return;
      }

      const mimeType = this.#recorder.mimeType.split(";").at(0) ?? "video/mp4";
      const blob = new Blob(this.#blobs, { type: mimeType });
      const reader = new FileReader();
      reader.addEventListener("loadend", () => {
        this.#stopStream();
        this.type = mimeType;
        this.#recorder = null;
        this.#value = reader.result as string;
        this.#renderableValue = URL.createObjectURL(blob);
      });
      reader.readAsDataURL(blob);
    };

    this.#recorder.start();
  }

  stop() {
    if (!this.#recorder) {
      return;
    }

    this.#recorder.stop();
  }

  render() {
    if (this.error) {
      return html`${this.error}`;
    }

    let renderable = html`<canvas
      ${ref((el) => {
        if (el) {
          this.#showRecordButton = true;
        }

        const draw = () => {
          if (!el) {
            return;
          }

          const canvas = el as HTMLCanvasElement;
          if (this.#width !== canvas.width) {
            canvas.width = this.#width;
            canvas.height = this.#height;
          }

          const context = canvas.getContext("2d");
          if (!context) {
            return;
          }

          context.drawImage(this.#preview, 0, 0);
          requestAnimationFrame(() => {
            draw();
          });
        };

        requestAnimationFrame(() => {
          draw();
        });
      })}
    ></canvas>`;
    if (this.#value) {
      renderable = html`<video
        controls
        type="video/x-matroska"
        src=${this.#renderableValue}
      ></video>`;
    }

    return html`<section>
      ${renderable}
      <div id="controls">
        ${this.#recorder
          ? html`<button
              id="stop"
              @click=${() => {
                this.stop();
              }}
            >
              <span class="g-icon">stop_circle</span>Stop
            </button>`
          : this.#showRecordButton
            ? html`<button
                @click=${(evt: Event) => {
                  if (!(evt.target instanceof HTMLButtonElement)) {
                    return;
                  }

                  evt.target.disabled = true;
                  this.record();
                }}
              >
                <span class="g-icon">radio_button_checked</span> Record
              </button>`
            : nothing}
      </div>
    </section>`;
  }
}
