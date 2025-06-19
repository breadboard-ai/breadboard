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

const TOGGLE_DELTA = 250;

@customElement("bb-speech-to-text")
export class SpeechToText extends LitElement {
  @property({ type: Boolean })
  accessor disabled = false;

  @property({ reflect: true, type: Boolean })
  accessor active = false;

  static styles = [
    icons,
    css`
      :host {
        display: block;
        position: relative;
        width: var(--button-size, 40px);
        height: var(--button-size, 40px);

        --active-color: linear-gradient(
          oklch(
              from var(--p-50, var(--bb-neutral-600)) l c h / calc(alpha * 0.7)
            )
            0%,
          oklch(
              from var(--p-50, var(--bb-neutral-600)) l c h / calc(alpha * 0.44)
            )
            34%,
          oklch(
              from var(--p-50, var(--bb-neutral-600)) l c h / calc(alpha * 0.2)
            )
            69%,
          oklch(from var(--p-50, var(--bb-neutral-600)) l c h / calc(alpha * 0))
            99%
        );
      }

      :host([active]) button {
        animation: pulse linear 1s infinite forwards;

        --default-background: var(
          --background-color,
          var(--n-90, var(--bb-neutral-200))
        );

        &::before {
          box-sizing: border-box;
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;

          border: 2px solid transparent;
          border-radius: 50%;
          background: var(
              --active-color,
              linear-gradient(var(--default-background), transparent)
            )
            border-box;
          mask:
            linear-gradient(#ff00ff 0 0) padding-box,
            linear-gradient(#ff00ff 0 0);
          mask-composite: exclude;
          animation: rotate linear 0.5s infinite forwards;
        }
      }

      #checking-permission {
        width: var(--button-size, 40px);
        height: var(--button-size, 40px);
        font-size: 0;

        background: var(--bb-progress, url(/images/progress-ui.svg)) center
          center / 20px 20px no-repeat;
      }

      button {
        width: var(--button-size, 40px);
        height: var(--button-size, 40px);
        background: var(--background-color, var(--n-90, var(--bb-neutral-200)));
        color: var(--text-color, var(--n-0, var(--bb-neutral-800)));
        font-size: 0;
        border: none;
        border-radius: 50%;
        padding: 0;
        margin: 0;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);

        & .g-icon {
          font-size: 30px;
        }

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
        from {
          rotate: 0deg;
        }

        to {
          rotate: 360deg;
        }
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
  #activeStartTime = 0;
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
    this.active = true;
    this.#activeStartTime = window.performance.now();
  }

  #stopTranscription() {
    if (!this.#recognition) {
      return;
    }

    this.#recognition.stop();
    this.active = false;
  }

  render() {
    if (!this.#speechRecognition) {
      return nothing;
    }

    return this.#permissionTask.render({
      pending: () => {
        return html`<div id="checking-permission">
          <span class="g-icon filled round">pending</span>
        </div>`;
      },

      complete: () => {
        return html`<button
          ?disabled=${this.disabled}
          @pointerdown=${(evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLElement)) {
              return;
            }

            evt.target.setPointerCapture(evt.pointerId);

            // Our approach here involves allowing the user to interact in one
            // of two ways. Supposing they tap the button and release quickly.
            // In this case we will not stop the transcription, but will go into
            // more of a toggled mode, requiring them to press the button a
            // second time.
            //
            // On the other hand, if they press and hold then when they release
            // we will stop the transcription.
            if (this.active) {
              this.#stopTranscription();
            } else {
              this.#startTranscription();
            }
          }}
          @pointerup=${() => {
            if (
              window.performance.now() - this.#activeStartTime <
              TOGGLE_DELTA
            ) {
              return;
            }

            if (!this.active) {
              return;
            }

            this.#stopTranscription();
          }}
        >
          <span class="g-icon filled round">mic</span>
        </button>`;
      },

      error: () => {
        return html`<button
          ?disabled=${this.disabled}
          @pointerdown=${() => {
            this.#requestPermission();
          }}
        >
          <span class="g-icon filled round">mic</span>
        </button>`;
      },
    });
  }
}
