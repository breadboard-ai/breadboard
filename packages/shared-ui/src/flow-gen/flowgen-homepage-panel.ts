/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../strings/helper.js";
import { outlineButtonWithIcon } from "../styles/outline-button-with-icon.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { StateEvent, UtteranceEvent } from "../events/events.js";
import type { ExpandingTextarea } from "../elements/input/expanding-textarea.js";
import { icons } from "../styles/icons.js";
import "../elements/input/expanding-textarea.js";
import { type FlowGenerator, flowGeneratorContext } from "./flow-generator.js";
import { classMap } from "lit/directives/class-map.js";
import { spinAnimationStyles } from "../styles/spin-animation.js";
import { ActionTracker } from "../utils/action-tracker.js";
import { colorsLight } from "../styles/host/colors-light.js";
import { type } from "../styles/host/type.js";

const Strings = StringsHelper.forSection("ProjectListing");
const GlobalStrings = StringsHelper.forSection("Global");

type State =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown };

const SAMPLE_INTENTS = [
  "Create a flow that takes a business name and description, searches information about the business, and generates a social media post with an eye-catching picture.",
  "Create a research agent agent that takes a product, performs research on the web, and produces a competitive analysis report about the product.",
  "Create an app that takes a movie plot description, and generates 3 scene descriptions, along with a compelling storyboard sketch for each scene.",
  "Create a workflow that takes a job description and a potential job candidate and generates a personalized recruitment email for the candidate. Do research about the candidate to personalize the email.",
];

const SAMPLE_INTENTS_ROTATION_MS = 7000;

@customElement("bb-flowgen-homepage-panel")
export class FlowgenHomepagePanel extends LitElement {
  static styles = [
    outlineButtonWithIcon,
    icons,
    spinAnimationStyles,
    colorsLight,
    type,
    css`
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin: 15px 0 0 0;
      }

      #dismiss-button {
        background: none;
        border: none;
        color: var(--n-0);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        margin-left: var(--bb-grid-size-5);
      }

      .dismiss-button:hover {
        color: var(--bb-neutral-400);
      }

      p {
        word-break: break-all;
        color: var(--n-0);
        margin: var(--bb-grid-size-2) 0;

        & .error {
          word-break: auto-phrase;
          color: var(--e-30);
        }
      }

      #feedback {
        color: var(--n-0);
        transition: var(--color-transition);
        background: var(--n-100);
        border-radius: var(--bb-grid-size-2);
        padding-left: var(--bb-grid-size-5);
        padding-right: var(--bb-grid-size-5);
        word-break: break-all;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: var(--bb-grid-size-4);
        text-align: center;
      }

      #gradient-border-container {
        flex: 1;
        display: flex;
        align-items: center;
        width: 100%;
        background: var(--ui-custom-o-10);
        border-radius: var(--bb-grid-size-16);
        padding: var(--bb-grid-size-3);
        margin: var(--bb-grid-size-5) 0 0 0;
      }

      bb-speech-to-text {
        --button-size: var(--bb-grid-size-9);
        --alpha-adjustment: 0;
        --background-color: transparent;
        --active-color: linear-gradient(
          rgb(177, 207, 250) 0%,
          rgb(198, 210, 243) 34%,
          rgba(210, 212, 237, 0.4) 69%,
          rgba(230, 217, 231, 0) 99%
        );
        margin-left: var(--bb-grid-size-4);
      }

      bb-expanding-textarea {
        flex: 1;
        width: 100%;
        background: #fff;
        color: var(--n-0, var(--bb-neutral-900));
        border: none;
        border-radius: 40px;
        padding: 0.5lh 1lh;
        --min-lines: 1;
        --max-lines: 6;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        line-height: 20px;
        caret-color: var(--bb-ui-500);

        &::part(textarea)::placeholder {
          color: var(--bb-neutral-500);
        }

        &:focus-within {
          outline: 1px solid var(--ui-custom-o-100);
        }

        > [slot~="submit"] {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: var(--n-70);
          font-size: 30px;
          width: 30px;
          height: 30px;
          margin-left: var(--bb-grid-size-4);
        }
      }
    `,
  ];

  @consume({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator | undefined = undefined;

  @state()
  accessor #state: State = { status: "initial" };

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @state()
  accessor #sampleIntentIndex = Math.floor(
    Math.random() * SAMPLE_INTENTS.length
  );

  #rotateSampleIntentTimerId?: ReturnType<typeof setInterval>;

  readonly #descriptionInput = createRef<ExpandingTextarea>();

  override connectedCallback() {
    super.connectedCallback();
    this.#rotateSampleIntentTimerId = setInterval(
      () =>
        (this.#sampleIntentIndex =
          (this.#sampleIntentIndex + 1) % SAMPLE_INTENTS.length),
      SAMPLE_INTENTS_ROTATION_MS
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#rotateSampleIntentTimerId);
    this.#rotateSampleIntentTimerId = undefined;
  }

  override render() {
    const errorFeedback = html` <div id="feedback">
      <p class="sans-flex md-body-medium">${this.#renderFeedback()}</p>
      <button id="dismiss-button" @click=${this.#onClearError}>
        <span class="g-icon filled round">close</span>
      </button>
    </div>`;
    const statusFeedback = html`<p class="sans-flex md-body-medium">
      ${this.#renderFeedback()}
    </p>`;
    return [
      this.#state.status === "error" ? errorFeedback : statusFeedback,
      this.#renderInput(),
    ];
  }

  override async updated(changes: PropertyValues) {
    if (changes.has("#state") && this.#state.status === "error") {
      this.#descriptionInput.value?.focus();
      this.highlighted = true;
      setTimeout(() => (this.highlighted = false), 2500);
    }
  }

  #renderFeedback() {
    switch (this.#state.status) {
      case "initial": {
        return Strings.from("LABEL_WELCOME_CTA");
      }
      case "generating": {
        return Strings.from("LABEL_GENERATING_FLOW");
      }
      case "error": {
        let error = this.#state.error as
          | string
          | { message?: string }
          | { error: { message?: string } | string };
        if (typeof error === "object" && error !== null && "error" in error) {
          // Errors from Breadboard are often wrapped in an {error: <Error>}
          // structure. Unwrap if needed.
          error = error.error;
        }
        let message;
        if (typeof error === "object" && error !== null && "message" in error) {
          message = error.message;
        } else {
          message = String(error);
        }
        return html`<span class="error">${message}</span>`;
      }
      default: {
        this.#state satisfies never;
      }
    }
  }

  #renderInput() {
    const isGenerating = this.#state.status === "generating";
    return html`
      <div id="gradient-border-container">
        <bb-expanding-textarea
          ${ref(this.#descriptionInput)}
          .placeholder=${SAMPLE_INTENTS[this.#sampleIntentIndex]}
          .tabCompletesPlaceholder=${true}
          .disabled=${isGenerating}
          @change=${this.#onInputChange}
        >
          <bb-speech-to-text
            slot="mic"
            @bbutterance=${(evt: UtteranceEvent) => {
              if (!this.#descriptionInput.value) {
                return;
              }

              this.#descriptionInput.value.value = evt.parts
                .map((part) => part.transcript)
                .join("");
            }}
          ></bb-speech-to-text>
          <span
            slot="submit"
            class=${classMap({
              "g-icon": true,
              filled: true,
              spin: isGenerating,
            })}
            >${isGenerating ? "progress_activity" : "send"}</span
          >
        </bb-expanding-textarea>
      </div>
    `;
  }

  #onInputChange() {
    const input = this.#descriptionInput.value;
    const description = input?.value;
    if (description) {
      if (description === "/force generating") {
        this.#state = { status: "generating" };
        return;
      } else if (description === "/force initial") {
        this.#state = { status: "initial" };
        return;
      }

      ActionTracker.flowGenCreate();

      this.#state = { status: "generating" };
      void this.#generateBoard(description)
        .then((graph) => this.#onGenerateComplete(graph))
        .catch((error) => this.#onGenerateError(error));
    }
  }

  #onClearError() {
    this.#state = { status: "initial" };
  }

  async #generateBoard(intent: string): Promise<GraphDescriptor> {
    if (!this.flowGenerator) {
      throw new Error(`No FlowGenerator was provided`);
    }
    const { flow } = await this.flowGenerator.oneShot({ intent });
    return flow;
  }

  #onGenerateComplete(graph: GraphDescriptor) {
    if (this.#state.status !== "generating") {
      return;
    }

    this.dispatchEvent(
      new StateEvent({
        eventType: "board.create",
        editHistoryCreator: {
          role: "assistant",
        },
        graph,
        messages: {
          start: GlobalStrings.from("STATUS_CREATING_PROJECT"),
          end: GlobalStrings.from("STATUS_PROJECT_CREATED"),
          error: GlobalStrings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
        },
      })
    );
  }

  #onGenerateError(error: unknown) {
    if (this.#state.status !== "generating") {
      return;
    }
    console.error("Error generating board", error);
    this.#state = { status: "error", error };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-describe-flow-panel": FlowgenHomepagePanel;
  }
}
