/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { icons } from "../../../styles/icons";
import { colorsLight } from "../../../styles/host/colors-light";

@customElement("bb-webcam-video-input")
export class WebcamVideoInput extends LitElement {
  @property()
  accessor type = "";

  @state()
  accessor error = "";

  @state()
  accessor #capturing = false;

  @state()
  accessor #starting = false;

  @state()
  accessor #value: string | null = null;

  static styles = [
    colorsLight,
    icons,
    css`
      :host {
        display: block;
        width: 100%;
        background-color: var(
          --bb-input-background-color,
          var(--default-bb-input-background-color)
        );
        aspect-ratio: 4/3;
        outline: 1px solid var(--bb-outline, var(--default-bb-outline));
        position: relative;
      }

      .progress {
        position: absolute;
        top: calc(50% - 10px);
        left: calc(50% - 10px);
        color: var(--n-0);
        animation: rotate linear 1s infinite forwards;
      }

      section {
        display: grid;
        grid-template-rows: 1fr 0;
        align-items: center;

        & #controls {
          position: relative;
        }
      }

      button {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--bb-grid-size-16);
        background: var(--n-0, var(--bb-neutral-100)) 8px center / 20px 20px
          no-repeat;
        color: var(--n-100, var(--bb-neutral-800));
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        border: none;
        border: none;
        transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
        position: absolute;
        top: -16px;
        left: calc(50% - 16px);
        padding: 0;

        > .g-icon {
          pointer-events: none;
          font-size: 24px;
        }

        &:not([disabled]) {
          cursor: pointer;
        }

        &#stop {
          > .g-icon {
            color: red;
            animation: pulse linear 1s infinite forwards;
          }
        }
      }

      canvas,
      video {
        aspect-ratio: 4/3;
        display: block;
        width: 100%;
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

      @keyframes rotate {
        0% {
          rotate: 0deg;
        }

        100% {
          rotate: 360deg;
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
    this.#starting = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    this.#starting = false;

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

    return html` ${this.#starting
        ? html`<span class="g-icon progress filled round"
            >progress_activity</span
          >`
        : nothing}
      <section>
        ${renderable}
        <div id="controls">
          ${this.#recorder
            ? html`<button
                id="stop"
                @click=${() => {
                  this.stop();
                }}
              >
                <span class="g-icon filled round">stop_circle</span>
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
                  <span class="g-icon filled round">radio_button_checked</span>
                </button>`
              : nothing}
        </div>
      </section>`;
  }
}
