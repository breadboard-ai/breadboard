/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ImageHandler } from "./types.js";

export class Webcam extends HTMLElement implements ImageHandler {
  #stream!: MediaStream;
  #video = document.createElement("video");
  #active = false;

  constructor(public target: HTMLCanvasElement) {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          overflow: hidden;
        }

        ::slotted(canvas) {
          display: block;
          width: 100%;
        }
      </style>
      <slot></slot>
    `;

    this.#video.autoplay = true;
    this.#video.addEventListener("loadeddata", () => {
      this.target.width = this.#video.videoWidth;
      this.target.height = this.#video.videoHeight;
    });

    this.appendChild(this.target);
  }

  async start() {
    this.#stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
    this.#video.srcObject = this.#stream;

    this.#active = true;
    const context = this.target.getContext("2d");
    const render = () => {
      if (!this.#active) {
        return;
      }

      context?.drawImage(this.#video, 0, 0);
      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  stop() {
    if (!this.#stream) {
      return;
    }

    for (const track of this.#stream.getTracks()) {
      track.stop();
      this.#stream.removeTrack(track);
    }

    this.#active = false;
  }
}
