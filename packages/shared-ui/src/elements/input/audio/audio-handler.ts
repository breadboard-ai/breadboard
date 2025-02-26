/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../../strings/helper.js";
const Strings = StringsHelper.forSection("AudioHandler");

import { LLMContent } from "@breadboard-ai/types";
import { asBase64 } from "@google-labs/breadboard";
import { Task } from "@lit/task";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { HideTooltipEvent, ShowTooltipEvent } from "../../../events/events";

const PCM_AUDIO = "audio/l16;codec=pcm;rate=24000";

@customElement("bb-audio-handler")
export class AudioHandler extends LitElement {
  @property({ reflect: true, type: Boolean })
  accessor audioFile: Blob | null = null;

  @property({ reflect: true })
  accessor state: "recording" | "playing" | "paused" | "idle" = "idle";

  @property({ reflect: true })
  accessor showAudioData = true;

  @property({ reflect: true })
  accessor canRecord = false;

  @property({ reflect: true })
  accessor lite = false;

  @property()
  accessor steps = 7;

  @property()
  accessor lineWidth = 3;

  @property()
  accessor lineGap = 5;

  @property()
  accessor color = "#77bbff";

  @property()
  accessor lineCap: CanvasLineCap = "round";

  @property()
  accessor playheadTime = 0;

  @property()
  accessor showPermissionStatus = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    #request-permission {
      height: var(--bb-grid-size-10);
      color: var(--bb-neutral-700);
      border-radius: var(--bb-grid-size-16);
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
      transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
      grid-column: 1 / 4;
      cursor: pointer;

      &:hover,
      &:focus {
        background-color: var(--bb-neutral-50);
      }
    }

    #container {
      overflow: hidden;
      position: relative;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-16);
      background: var(--bb-neutral-0);
      width: var(--bb-grid-size-11);
      height: var(--bb-grid-size-14);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-2);
      display: grid;
      grid-template-columns: var(--bb-grid-size-8);
      align-items: center;

      canvas {
        display: none;
      }

      & #play,
      & #capture {
        width: var(--bb-grid-size-10);
        height: var(--bb-grid-size-10);
        border-radius: 50%;
        background: transparent;
        border: none;
        font-size: 0;
        cursor: pointer;
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        opacity: 0.4;
        overflow: hidden;
        padding: 0;
      }

      & #play {
        background: var(--color-play-button, var(--bb-ui-500))
          var(--icon-play, var(--bb-icon-play-filled-inverted)) center center /
          20px 20px no-repeat;

        &.playing {
          background: var(--color-play-button, var(--bb-ui-500))
            var(--icon-play, var(--bb-icon-pause-filled-inverted)) center
            center / 20px 20px no-repeat;
        }

        &:not([disabled]) {
          opacity: 1;

          &:hover,
          &:focus {
            background-color: var(--color-play-button-active, var(--bb-ui-600));
          }
        }
      }

      & #capture {
        background: var(--color-capture-button, var(--bb-ui-500))
          var(--icon-mic, var(--bb-icon-mic-inverted)) center center / 20px 20px
          no-repeat;

        &.playing {
          background: var(--color-capture-button, var(--bb-ui-500))
            var(--icon-mic, var(--bb-icon-mic-inverted)) center center / 20px
            20px no-repeat;
        }

        &:not([disabled]) {
          opacity: 1;

          &:hover,
          &:focus {
            background-color: var(
              --color-capture-button-active,
              var(--bb-ui-600)
            );
          }
        }
      }

      & #reset-container {
        height: var(--bb-grid-size-10);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 0 0 var(--bb-grid-size-2);
        white-space: nowrap;
        font: 500 var(--bb-label-small) / var(--bb-label-line-height-small)
          var(--bb-font-family);
        color: var(--reset-text-color, var(--bb-neutral-700));

        & #stop,
        & #reset {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent var(--icon-reset, var(--bb-icon-restart-alt))
            center center / 20px 20px no-repeat;
          border: none;
          cursor: pointer;
          height: 20px;
          width: 20px;
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          color: var(--bb-neutral-700);
          font-size: 0;
          margin: 0 var(--bb-grid-size-2);

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }
    }

    :host([showaudiodata="true"]) {
      #container {
        grid-template-columns: var(--bb-grid-size-10) minmax(0, 1fr) min-content;
        column-gap: 8px;
        width: 100%;
        height: 56px;

        #canvas-container {
          overflow: hidden;
        }

        & canvas {
          display: block;
          width: 100%;
          height: 56px;
        }
      }
    }

    :host([lite="true"]) {
      #request-permission {
        font-size: 0;
        background: var(--color-capture-button, var(--bb-ui-500))
          var(--icon-mic, var(--bb-icon-mic-inverted)) center center / 20px 20px
          no-repeat;
      }
    }

    :host([showaudiodata="true"][lite="true"]) {
      #container {
        border: none;
        padding: 0;
        border-radius: 0;
        overflow: hidden;
        grid-template-columns: 0 0 1fr;
        column-gap: 0;
        height: var(--bb-grid-size-10);

        & #play {
          width: 0;
        }

        & #reset-container {
          padding-left: 0;
        }

        & canvas {
          height: var(--bb-grid-size-10);
        }
      }
    }

    :host([showaudiodata="true"][lite="true"][audiofile]),
    :host([showaudiodata="true"][lite="true"][state="recording"]) {
      #container {
        & #play {
          width: var(--bb-grid-size-10);
        }

        grid-template-columns: var(--bb-grid-size-10) minmax(0, 1fr) min-content;
        column-gap: var(--bb-grid-size-2);

        & #reset-container {
          padding-left: var(--bb-grid-size-2);
        }
      }
    }
  `;

  #mediaStream: MediaStream | null = null;
  #mimeType: string = "audio/ogg";
  #recorder: MediaRecorder | null = null;
  #parts: Blob[] = [];
  #audioFileUrl: string | null = null;
  #value: string | null = null;

  #audioCtx: AudioContext | null = null;
  #analyser: AnalyserNode | null = null;

  #visualizationCanvasContainerRef: Ref<HTMLDivElement> = createRef();
  #visualizationCanvasRef: Ref<HTMLCanvasElement> = createRef();
  #visualizationWidth = 0;
  #visualizationHeight = 0;
  #stepData = new Float32Array(1).fill(0);
  #taperData = new Float32Array(1).fill(0);
  #playbackDuration = 0;

  #recorderSource: MediaStreamAudioSourceNode | null = null;
  #playbackSource: AudioBufferSourceNode | null = null;

  #permissionTask = new Task(this, {
    task: async () => {
      if (!this.canRecord) {
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      if (
        !devices ||
        devices.every((d) => d.label === null || d.label === "")
      ) {
        throw new Error("No permission");
      }
    },
    args: () => [],
  });

  get value(): LLMContent {
    return {
      role: "user",
      parts: [
        {
          inlineData: { data: this.#value ?? "", mimeType: this.#mimeType },
        },
      ],
    };
  }

  #formatSeconds(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toFixed(0).padStart(2, "0")}`;
  }

  #createVisualizationFromStream(mediaStream: MediaStream) {
    if (!this.#visualizationCanvasRef.value) {
      return;
    }

    const ctx = this.#visualizationCanvasRef.value.getContext("2d");
    if (!ctx) {
      return;
    }

    if (!this.#audioCtx) {
      this.#audioCtx = new AudioContext();
    }

    this.#analyser = this.#audioCtx.createAnalyser();
    this.#analyser.fftSize = 128;
    this.#recorderSource = new MediaStreamAudioSourceNode(this.#audioCtx, {
      mediaStream,
    });
    this.#recorderSource.connect(this.#analyser);
  }

  #ease(v: number, p = 2) {
    return 1 - Math.pow(1 - v, p);
  }

  #startVisualization() {
    let lastFrame = 0;
    const updateVisualization = () => {
      const canvas = this.#visualizationCanvasRef.value;
      if (!canvas) {
        return;
      }

      if (
        this.steps !== this.#stepData.length ||
        this.steps !== this.#taperData.length
      ) {
        this.#stepData = new Float32Array(this.steps).fill(0);
        this.#taperData = new Float32Array(this.steps).fill(0).map((_, idx) => {
          const taper = (0.5 - Math.abs(idx / (this.steps - 1) - 0.5)) / 0.5;
          return this.#ease(taper, 2);
        });
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      let data;
      if (this.#audioCtx && this.#analyser) {
        data = new Uint8Array(this.#analyser.frequencyBinCount);

        if (this.#audioCtx.state === "running") {
          this.#analyser.getByteTimeDomainData(data);

          if (this.state === "playing") {
            if (lastFrame > 0) {
              this.playheadTime +=
                (window.performance.now() - lastFrame) / 1000.0;
            }
            lastFrame = window.performance.now();

            this.playheadTime = this.#clamp(
              this.playheadTime,
              0,
              this.#playbackDuration
            );
          } else {
            lastFrame = 0;
          }
        } else {
          lastFrame = 0;
          data.fill(128.0);
        }
      } else {
        data = new Uint8Array(this.steps).fill(128.0);
        lastFrame = 0;
      }

      const totalWidth = (this.steps - 1) * this.lineGap;
      const dataStep = Math.floor(data.length / this.steps);
      const midY = this.#visualizationHeight / 2;
      const startX = (this.#visualizationWidth - totalWidth) / 2;

      ctx.clearRect(0, 0, this.#visualizationWidth, this.#visualizationHeight);
      ctx.save();
      ctx.lineWidth = this.lineWidth;
      ctx.lineCap = this.lineCap;
      ctx.strokeStyle = this.color;

      for (let i = 0; i < this.steps; i++) {
        const idx = i * dataStep;
        const normalizedDataValue = Math.abs((data[idx] - 128.0) / 128.0);
        const easedDataValue = this.#ease(normalizedDataValue, 9);
        this.#stepData[i] += (easedDataValue - this.#stepData[i]) * 0.2;

        const x = startX + i * this.lineGap;
        const h = this.#stepData[i] * midY * (0.2 + this.#taperData[i] * 0.75);

        ctx.beginPath();
        ctx.moveTo(x, midY - h);
        ctx.lineTo(x, midY + h);
        ctx.stroke();
        ctx.closePath();
      }

      ctx.restore();

      requestAnimationFrame(updateVisualization);
    };

    requestAnimationFrame(updateVisualization);
  }

  #clamp(v: number, min = 0, max = 0) {
    if (v > max) {
      v = max;
    }

    if (v < min) {
      v = min;
    }

    return v;
  }

  #createRecorderFromStream(mediaStream: MediaStream) {
    this.#parts = [];

    if (this.#audioFileUrl) {
      URL.revokeObjectURL(this.#audioFileUrl);
      this.#audioFileUrl = null;
    }

    this.#recorder = new MediaRecorder(mediaStream, {
      mimeType: "audio/webm",
    });

    this.#recorder.addEventListener("dataavailable", (evt) => {
      this.#mimeType = evt.data.type.replace(/;.*$/, "");
      this.#parts.push(evt.data);
    });

    this.#recorder.addEventListener("stop", async () => {
      this.audioFile = new Blob(this.#parts, {
        type: this.#mimeType,
      });

      this.#value = await asBase64(this.audioFile);
    });

    this.#recorder.start();
  }

  async #startRecording() {
    await this.#stopPlayback();

    this.audioFile = null;
    if (this.state === "recording") {
      return;
    }

    this.state = "recording";

    this.#mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    if (!this.#mediaStream) {
      // TODO: emit a warning.
      return;
    }

    if (this.state !== "recording") {
      this.#stopRecording();
      return;
    }

    this.#createVisualizationFromStream(this.#mediaStream);
    this.#createRecorderFromStream(this.#mediaStream);
  }

  async #resetAudio() {
    if (this.state !== "idle") {
      await this.#stopPlayback();
      await this.#stopRecording();
    }

    this.audioFile = null;
    this.playheadTime = 0;
  }

  async #stopRecording() {
    if (this.#audioCtx) {
      await this.#audioCtx.close();
      this.#audioCtx = null;
    }

    if (this.state !== "recording") {
      return;
    }

    if (this.#recorder) {
      this.#recorder.stop();
      this.#recorder = null;
    }

    const stream = this.#mediaStream;
    if (!stream) {
      return;
    }

    for (const track of stream.getAudioTracks()) {
      track.stop();
    }

    this.#mediaStream = null;

    if (this.#recorderSource) {
      this.#recorderSource.disconnect();
      this.#recorderSource = null;
    }

    if (this.#analyser) {
      this.#analyser.disconnect();
      this.#analyser = null;
    }

    this.state = "idle";
  }

  #convert(rawData: ArrayBuffer): Promise<AudioBuffer> {
    const TO_FLOAT = 32768;
    const sampleRate = 24000;
    const audioDataIn = new Int16Array(rawData);
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

  async #startPlayback() {
    if (!this.audioFile) {
      return;
    }

    if (this.state === "playing") {
      return;
    }

    const rawBuffer = await this.audioFile.arrayBuffer();

    if (!this.#audioCtx) {
      this.#audioCtx = new AudioContext();
    }

    let buffer: AudioBuffer;
    if (this.audioFile.type.toLocaleLowerCase() === PCM_AUDIO) {
      buffer = await this.#convert(rawBuffer);
    } else {
      buffer = await this.#audioCtx.decodeAudioData(rawBuffer);
    }

    this.#playbackDuration = buffer.duration;

    this.#analyser = this.#audioCtx.createAnalyser();
    this.#analyser.fftSize = 512;

    this.playheadTime = 0;
    this.#playbackSource = new AudioBufferSourceNode(this.#audioCtx, {
      buffer,
    });
    this.#playbackSource.connect(this.#analyser);
    this.#analyser.connect(this.#audioCtx.destination);

    this.#audioCtx = new AudioContext();
    this.#playbackSource.start();
    this.#playbackSource.addEventListener("ended", () => {
      this.state = "idle";
      this.playheadTime = this.#playbackDuration;
    });

    this.state = "playing";
  }

  async #pausePlayback() {
    if (!this.#audioCtx) {
      return;
    }

    if (this.#playbackSource) {
      this.#playbackSource.playbackRate.value = 0;
    }

    await this.#audioCtx.suspend();
    this.state = "paused";
  }

  async #resumePlayback() {
    if (!this.#audioCtx) {
      return;
    }

    if (this.#playbackSource) {
      this.#playbackSource.playbackRate.value = 1;
    }

    await this.#audioCtx.resume();
    this.state = "playing";
  }

  async #stopPlayback() {
    if (this.#audioCtx) {
      await this.#audioCtx.close();
      this.#audioCtx = null;
    }

    if (!this.#playbackSource) {
      return;
    }

    this.#playbackSource.stop();

    if (this.#playbackSource) {
      this.#playbackSource.disconnect();
      this.#playbackSource = null;
    }

    if (this.#analyser) {
      this.#analyser.disconnect();
      this.#analyser = null;
    }

    this.state = "idle";
  }

  async #requestPermission() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getAudioTracks()) {
      track.stop();
    }

    this.#permissionTask.run();
  }

  #resizeObserver = new ResizeObserver((entries) => {
    const canvas = this.#visualizationCanvasRef.value;
    if (!canvas) {
      return;
    }

    const dPR = window.devicePixelRatio;

    const bounds = entries[0].contentRect;
    const { width, height } = bounds;

    this.#visualizationWidth = width;
    this.#visualizationHeight = height;

    canvas.width = width * dPR;
    canvas.height = height * dPR;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dPR, dPR);

    if (this.lineGap) {
      this.steps = Math.max(0, Math.floor(width / this.lineGap) - 4);
    }
  });

  #mutationObserver = new MutationObserver(() => {
    if (!this.#visualizationCanvasRef.value) {
      return;
    }

    if (!this.showAudioData) {
      return;
    }

    const canvasContainer = this.#visualizationCanvasContainerRef.value;
    if (!canvasContainer) {
      return;
    }

    this.#mutationObserver.disconnect();
    this.#resizeObserver.observe(canvasContainer);

    this.#startVisualization();
  });

  connectedCallback(): void {
    super.connectedCallback();

    this.#mutationObserver.observe(this.shadowRoot!, {
      childList: true,
      subtree: true,
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#mutationObserver.disconnect();
    this.#resizeObserver.disconnect();
  }

  render() {
    const canvas = this.showAudioData
      ? guard(
          [],
          () => html`<canvas ${ref(this.#visualizationCanvasRef)}></canvas>`
        )
      : nothing;

    return this.#permissionTask.render({
      pending: () =>
        html`<div id="container">
          ${this.showPermissionStatus
            ? html`<p>Checking permission...</p>`
            : nothing}
        </div>`,
      complete: () => {
        let label = "Play";
        switch (this.state) {
          case "paused": {
            label = "Resume";
            break;
          }

          case "playing": {
            label = "Pause";
            break;
          }
        }

        return html` <div id="container">
          <button
            id="play"
            class=${classMap({ [this.state]: true })}
            ?disabled=${!this.audioFile}
            @click=${() => {
              switch (this.state) {
                case "idle":
                case "recording": {
                  this.#startPlayback();
                  break;
                }

                case "paused": {
                  this.#resumePlayback();
                  break;
                }

                case "playing": {
                  this.#pausePlayback();
                  break;
                }
              }
            }}
          >
            ${label}
          </button>
          <div
            id="canvas-container"
            ${ref(this.#visualizationCanvasContainerRef)}
          >
            ${canvas}
          </div>

          <div id="reset-container">
            ${this.playheadTime > 0
              ? html`${this.#formatSeconds(this.playheadTime)} /
                ${this.#formatSeconds(this.#playbackDuration)}`
              : nothing}
            ${this.canRecord
              ? this.audioFile
                ? html`<button
                    id="reset"
                    @click=${() => {
                      this.#resetAudio();
                    }}
                  >
                    Reset
                  </button>`
                : html`<button
                    id="capture"
                    @pointerover=${(evt: PointerEvent) => {
                      this.dispatchEvent(
                        new ShowTooltipEvent(
                          Strings.from("COMMAND_HOLD_TO_RECORD"),
                          evt.clientX,
                          evt.clientY
                        )
                      );
                    }}
                    @pointerout=${() => {
                      this.dispatchEvent(new HideTooltipEvent());
                    }}
                    @pointerdown=${(evt: PointerEvent) => {
                      if (!(evt.target instanceof HTMLElement)) {
                        return;
                      }

                      evt.target.setPointerCapture(evt.pointerId);
                      this.#startRecording();
                    }}
                    @pointerup=${() => {
                      this.#stopRecording();
                    }}
                  >
                    Hold to record
                  </button>`
              : nothing}
          </div>
        </div>`;
      },
      error: () =>
        html`<div id="container">
          <button id="request-permission" @click=${this.#requestPermission}>
            Request Permission
          </button>
        </div>`,
    });
  }
}
