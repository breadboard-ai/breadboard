/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Task } from "@lit/task";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Utterance } from "../../../types/types";
import { UtteranceEvent } from "../../../events/events";
import { icons } from "../../../styles/icons";

declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    start: () => void;
    stop: () => void;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }

  interface Window {
    SpeechRecognition: (new () => SpeechRecognition) | undefined;
    webkitSpeechRecognition: (new () => SpeechRecognition) | undefined;
  }
}

@customElement("bb-speech-to-text")
export class SpeechToText extends LitElement {
  @property({ type: Boolean })
  accessor disabled = false;

  static styles = [
    icons,
    css`
      :host {
        display: block;
      }

      #checking-permission {
        width: var(--button-size, 40px);
        height: var(--button-size, 40px);
        font-size: 0;

        background: var(--bb-progress, url(/images/progress-ui.svg)) center
          center / 20px 20px no-repeat;
      }

      button {
        --default-background: oklch(
          from var(--primary-text-color, var(--bb-neutral-900)) l c h /
            calc(alpha - 0.8)
        );

        width: var(--button-size, 40px);
        height: var(--button-size, 40px);
        color: var(--bb-icon-color, var(--bb-neutral-900));
        background: var(--background, var(--default-background, transparent));
        font-size: 0;
        border: none;
        border-radius: 50%;
        padding: 0;
        margin: 0;

        --transition-properties: opacity;
        transition: var(--transition);

        &[disabled] {
          cursor: auto;
          opacity: 0.8;
        }

        &:not([disabled]) {
          cursor: pointer;
          opacity: 0.8;

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }

      span:not(.final) {
        opacity: 0.7;
      }
    `,
  ];

  #parts: Utterance[] = [];
  #speechRecognition =
    window.SpeechRecognition ||
    (window.webkitSpeechRecognition as
      | (new () => SpeechRecognition)
      | undefined);
  #recognition: SpeechRecognition | null = null;
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

  constructor() {
    super();

    if (this.#speechRecognition) {
      this.#recognition = new this.#speechRecognition();
      this.#recognition.continuous = true;
      this.#recognition.lang = "en-US";
      this.#recognition.interimResults = false;
      this.#recognition.maxAlternatives = 1;
      this.#recognition.addEventListener("result", (evt: Event) => {
        this.#parts = [];

        const speechEvt = evt as SpeechRecognitionEvent;
        for (const result of speechEvt.results) {
          for (let i = 0; i < result.length; i++) {
            const entry = result.item(i);

            this.#parts.push({
              isFinal: result.isFinal,
              confidence: entry.confidence,
              transcript: entry.transcript,
            });
          }
        }

        this.dispatchEvent(new UtteranceEvent(this.#parts));
      });
    }
  }

  async #requestPermission() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getAudioTracks()) {
      track.stop();
    }

    this.#permissionTask.run();
  }

  #startTranscription() {
    if (!this.#recognition) {
      return;
    }

    this.#parts = [];
    this.#recognition.start();
  }

  #stopTranscription() {
    if (!this.#recognition) {
      return;
    }

    this.#recognition.stop();
  }

  render() {
    if (!this.#speechRecognition) {
      return nothing;
    }

    return this.#permissionTask.render({
      pending: () => {
        return html`<div id="checking-permission">Checking permission</div>`;
      },

      complete: () => {
        return html`<button
          ?disabled=${this.disabled}
          @pointerdown=${(evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLElement)) {
              return;
            }

            evt.target.setPointerCapture(evt.pointerId);
            this.#startTranscription();
          }}
          @pointerup=${() => {
            this.#stopTranscription();
          }}
        >
          <span class="g-icon">mic</span>
        </button>`;
      },

      error: () => {
        return html`<button
          ?disabled=${this.disabled}
          @pointerdown=${() => {
            this.#requestPermission();
          }}
        >
          Request Permission
        </button>`;
      },
    });
  }
}
