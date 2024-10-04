/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Task } from "@lit/task";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { asBase64 } from "@google-labs/breadboard";
import type { LLMContent } from "@breadboard-ai/types";

@customElement("bb-audio-input")
export class AudioInput extends LitElement {
  @property()
  audio: string | null = null;

  @state()
  recording: boolean = false;

  #stream: MediaStream | null = null;
  #output: string | null = null;
  #mimeType: string = "audio/ogg";
  #audioRef: Ref<HTMLAudioElement> = createRef();
  #recorder: MediaRecorder | null = null;
  #parts: Blob[] = [];

  #permissionTask = new Task(this, {
    task: async () => {
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

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    #play-audio {
      background: #fff var(--bb-icon-sound) 6px 3px / 16px 16px no-repeat;
      border-radius: 20px;
      color: var(--bb-neutral-900);
      border: 1px solid var(--bb-neutral-600);
      height: 24px;
      padding: 0 16px 0 28px;
      margin: calc(var(--bb-grid-size) * 2) 0 var(--bb-grid-size) 0;
      cursor: pointer;
      opacity: 0.5;
    }

    #play-audio:hover,
    #play-audio:focus {
      opacity: 1;
    }

    #capture {
      background: var(--bb-inputs-100);
      background-image: var(--bb-icon-mic-green);
      background-size: 16px 16px;
      background-position: 8px 4px;
      background-repeat: no-repeat;
      color: var(--bb-inputs-800);
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px 0 28px;
      margin: calc(var(--bb-grid-size) * 2) 0 var(--bb-grid-size) 0;
      cursor: pointer;
    }

    #capture:hover,
    #capture:focus {
      opacity: 1;
    }
  `;

  get value(): LLMContent {
    return {
      role: "user",
      parts: [
        {
          inlineData: { data: this.#output || "", mimeType: this.#mimeType },
        },
      ],
    };
  }

  async #requestPermission() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getAudioTracks()) {
      track.stop();
    }

    this.#permissionTask.run();
  }

  async #startRecording() {
    this.#output = null;
    this.#parts = [];
    if (this.audio) {
      URL.revokeObjectURL(this.audio);
      this.audio = null;
    }

    this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioTracks = this.#stream.getAudioTracks();
    if (audioTracks.length === 0) {
      this.#stopRecording();
      return;
    }

    this.#recorder = new MediaRecorder(this.#stream, {
      mimeType: "audio/webm",
    });

    this.#recorder.addEventListener("dataavailable", (evt) => {
      this.#mimeType = evt.data.type.replace(/;.*$/, "");
      this.#parts.push(evt.data);
    });

    this.#recorder.addEventListener("stop", async () => {
      // Take all the audio parts received and combine them into one Blob.
      const audioFile = new Blob(this.#parts, {
        type: this.#mimeType,
      });
      // Create a preview for the user.
      this.audio = URL.createObjectURL(audioFile);
      this.#output = await asBase64(audioFile);
    });

    this.#recorder.start();
  }

  #stopRecording() {
    if (this.#recorder) {
      this.#recorder.stop();
    }

    const stream = this.#stream;
    if (!stream) {
      return;
    }

    for (const track of stream.getAudioTracks()) {
      track.stop();
    }
  }

  render() {
    return this.#permissionTask.render({
      pending: () => html`Checking permission...`,
      complete: () => {
        return html`<button
            @pointerdown=${(evt: PointerEvent) => {
              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              evt.target.setPointerCapture(evt.pointerId);
              this.recording = true;
              this.#startRecording();
            }}
            @pointerup=${() => {
              this.recording = false;
              this.#stopRecording();
            }}
            id="capture"
          >
            Hold to record
          </button>
          <span>${this.recording ? "Recording..." : nothing}</span>
          ${this.audio
            ? html`<audio ${ref(this.#audioRef)} src="${this.audio}"></audio
                ><button
                  id="play-audio"
                  @click=${async () => {
                    if (!this.#audioRef.value) {
                      return;
                    }

                    const audio = this.#audioRef.value;
                    if (audio.paused) {
                      await audio.play();
                    } else {
                      audio.currentTime = 0;
                      audio.pause();
                    }
                  }}
                >
                  Play Audio
                </button>`
            : nothing}`;
      },
      error: () =>
        html`<button @click=${this.#requestPermission}>
          Request Permission
        </button>`,
    });
  }
}
