/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AppPreview");
const GlobalStrings = StringsHelper.forSection("Global");

import { LitElement, html, nothing, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  BoardServer,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  isLLMContentArray,
} from "@google-labs/breadboard";

import { until } from "lit/directives/until.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { styles as appPreviewStyles } from "./chat.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { markdown } from "../../directives/markdown.js";
import { SettingsStore } from "../../data/settings-store.js";
import { ChatConversationState, ChatState } from "../../state/types.js";

@customElement("bb-chat")
export class Chat extends LitElement {
  @property({ reflect: false })
  accessor graph: GraphDescriptor | null = null;

  /**
   * Provides an up-to-date model of the chat state.
   * See `ChatController` for the implementation that manages the model.
   */
  @property()
  accessor state: ChatState | null = null;

  @property({ reflect: false })
  accessor run: InspectableRun | null = null;

  @property({ reflect: false })
  accessor inputsFromLastRun: InspectableRunInputs | null = null;

  @property({ reflect: false })
  accessor events: InspectableRunEvent[] | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property({ reflect: true })
  accessor eventPosition = 0;

  @property()
  accessor settings: SettingsStore | null = null;

  @property({ reflect: true })
  accessor showHistory = false;

  static styles = appPreviewStyles;

  #newestEntry: Ref<HTMLElement> = createRef();

  protected updated(): void {
    if (!this.#newestEntry.value) {
      return;
    }

    this.#newestEntry.value.scrollIntoView({
      behavior: "smooth",
      block: "end",
      inline: "end",
    });
  }

  #renderSystemConversationItem(
    item: ChatConversationState
  ): HTMLTemplateResult[] {
    const items: HTMLTemplateResult[] = [];
    for (const entry of item.content) {
      if (item.role === "system") {
        items.push(html`<h3 class="entry-title">${entry.title}</h3>`);
      }

      if ("context" in entry) {
        items.push(
          html` <bb-llm-output-array
            .clamped=${false}
            .showModeToggle=${false}
            .showEntrySelector=${false}
            .showExportControls=${item.role === "system"}
            .values=${entry.context}
            .lite=${item.role === "user"}
          ></bb-llm-output-array>`
        );
      } else if ("object" in entry) {
        if (isLLMContentArray(entry.object)) {
          items.push(
            html` <bb-llm-output-array
              .clamped=${false}
              .showModeToggle=${false}
              .showEntrySelector=${false}
              .showExportControls=${item.role === "system"}
              .values=${entry.object}
              .lite=${item.role === "user"}
            ></bb-llm-output-array>`
          );
        } else {
          items.push(
            html` <div>
              <bb-json-tree .json=${entry.object}></bb-json-tree>
            </div>`
          );
        }
      } else if ("text" in entry) {
        if (entry.format === "markdown") {
          items.push(html` ${markdown(entry.text)}`);
        } else {
          items.push(html` <p>${entry.text}</p>`);
        }
      } else if ("error" in entry) {
        items.push(html` <p style="color:red">${entry.error}</p>`);
      }
    }

    return items;
  }

  render() {
    if (!this.state) {
      return html`<div id="click-run">
        ${Strings.from("LABEL_INITIAL_MESSAGE")}
      </div>`;
    }

    return html`<section id="content">
      <div id="log">
        ${repeat(this.state.conversation, (conversationItem, idx) => {
          const isLastPart = idx === this.state!.conversation.length - 1;

          let content: HTMLTemplateResult | symbol = nothing;
          switch (conversationItem.role) {
            case "system": {
              const classes: Record<string, boolean> = {
                ["system-output"]: true,
              };

              if (conversationItem.icon) {
                classes[conversationItem.icon] = true;
              }

              content = html` <div
                class=${classMap(classes)}
                ${isLastPart ? ref(this.#newestEntry) : nothing}
              >
                <h2 class="title">${conversationItem.name ?? "System"}</h2>
                <div class="value">
                  ${this.#renderSystemConversationItem(conversationItem)}
                </div>
              </div>`;
              break;
            }

            case "user": {
              content = html` <div
                class="user-output"
                ${isLastPart ? ref(this.#newestEntry) : nothing}
              >
                <div>
                  <h2 class="title">User Input</h2>
                  <div class="value">
                    ${this.#renderSystemConversationItem(conversationItem)}
                  </div>
                </div>
              </div>`;
            }
          }

          return html`${until(content)}`;
        })}
        ${this.state.status === "running"
          ? html` <h1 class="status">
              ${GlobalStrings.from("STATUS_GENERIC_WORKING")}
            </h1>`
          : nothing}
      </div>
    </section>`;
  }
}
