/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent } from "@breadboard-ai/types";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";

@customElement("bb-webcam-input")
export class WebcamInput extends LitElement {
  @property()
  type = "image/png";

  @state()
  error = "";

  static styles = css`
    :host {
      --default-bb-box-shadow: 0 6px 9px 0 rgba(0, 0, 0, 0.12),
        0 2px 3px 0 rgba(0, 0, 0, 0.23);
      --default-bb-border-radius: 8px;
      --default-bb-input-background-color: #fff;
      --default-bb-outline: transparent;

      display: block;
      width: 100%;
      background-color: var(
        --bb-input-background-color,
        var(--default-bb-input-background-color)
      );
      box-shadow: var(--bb-box-shadow, var(--default-bb-box-shadow));
      border-radius: var(--bb-grid-size);
      aspect-ratio: 4/3;
      outline: 1px solid var(--bb-outline, var(--default-bb-outline));
    }

    canvas {
      display: block;
      width: 100%;
      opacity: 0;
      border-radius: var(--bb-grid-size);
    }

    canvas.active {
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) both;
      animation-delay: 0.3s;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  #stream!: MediaStream;
  #canvasRef: Ref<HTMLCanvasElement> = createRef();
  #video = document.createElement("video");
  #active = false;

  constructor() {
    super();

    this.#video.autoplay = true;
    this.#video.addEventListener("loadeddata", () => {
      const canvas = this.#canvasRef.value;
      if (!canvas) {
        return;
      }

      canvas.width = this.#video.videoWidth;
      canvas.height = this.#video.videoHeight;
    });
  }

  connectedCallback(): void {
    super.connectedCallback();

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: true,
      })
      .then(
        (stream: MediaStream) => {
          this.#stream = stream;
          this.#video.srcObject = this.#stream;
          this.#active = true;

          if (this.#canvasRef.value) {
            this.#canvasRef.value.classList.add("active");
          }

          this.#drawVideoToCanvas();
        },
        () => {
          this.error = "Unable to access webcam - is there one attached?";
        }
      );
  }

  get value(): LLMContent {
    const inlineData = this.#canvasRef.value?.toDataURL(this.type, 80) || "";
    const preamble = `data:${this.type};base64,`;

    return {
      role: "user",
      parts: [
        {
          inlineData: {
            data: inlineData.substring(preamble.length),
            mimeType: this.type,
          },
        },
      ],
    };
  }

  disconnectedCallback(): void {
    if (!this.#stream) {
      return;
    }

    for (const track of this.#stream.getTracks()) {
      track.stop();
      this.#stream.removeTrack(track);
    }

    if (this.#canvasRef.value) {
      this.#canvasRef.value.classList.remove("active");
    }

    this.#active = false;
  }

  render() {
    if (this.error) {
      return html`${this.error}`;
    }

    return html`<canvas ${ref(this.#canvasRef)}></canvas>`;
  }

  #drawVideoToCanvas() {
    if (!this.#active || !this.#canvasRef.value) {
      return;
    }

    const context = this.#canvasRef.value.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(this.#video, 0, 0);
    requestAnimationFrame(() => {
      this.requestUpdate();
      this.#drawVideoToCanvas();
    });
  }
}
