/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { ref } from "lit/directives/ref.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { MainBase, RenderValues } from "./main-base.js";
import { IterateOnPromptMessage } from "./ui/embed/embed.js";
import { IterateOnPromptEvent } from "./ui/events/events.js";
import * as BreadboardUI from "./ui/index.js";
import { makeUrl, parseUrl } from "./ui/utils/urls.js";

import { CheckAppAccessResult } from "@breadboard-ai/types/opal-shell-protocol.js";
import { MakeUrlInit } from "./ui/types/types.js";

const Strings = BreadboardUI.Strings.forSection("Global");
const parsedUrl = parseUrl(window.location.href);

export { Main };

@customElement("bb-main")
class Main extends MainBase {
  override async doPostInitWork() {
    this.maybeNotifyAboutPreferredUrlForDomain();
    this.maybeNotifyAboutDesktopModality();
  }

  async maybeNotifyAboutPreferredUrlForDomain() {
    const domain = await this.signinAdapter.domain;
    if (!domain) {
      return;
    }
    const url = this.globalConfig.domains?.[domain]?.preferredUrl;
    if (!url) {
      return;
    }

    this.snackbar(
      html`
        Users from ${domain} should prefer
        <a href="${url}" target="_blank">${new URL(url).hostname}</a>
      `,
      BreadboardUI.Types.SnackType.WARNING,
      [],
      true
    );
  }

  maybeNotifyAboutDesktopModality() {
    if (
      parsedUrl.page !== "graph" ||
      !parsedUrl.shared ||
      parsedUrl.mode !== "canvas"
    ) {
      return;
    }

    // There's little point in attempting to differentiate between "mobile" and
    // "desktop" here for any number of reasons, but as a reasonable proxy we
    // will check that there's some screen estate available to show both the
    // editor and the app preview before we show the modal.
    if (window.innerWidth > 1280) {
      return;
    }

    this.uiState.show.add("BetterOnDesktopModal");
  }

  override async handleAppAccessCheckResult(
    result: CheckAppAccessResult
  ): Promise<void> {
    if (!result.canAccess) {
      await this.signinAdapter.signOut();
      window.history.pushState(
        undefined,
        "",
        makeUrl({
          page: "landing",
          geoRestriction: true,
          redirect: {
            page: "home",
            guestPrefixed: true,
          },
          guestPrefixed: true,
        })
      );
      window.location.reload();
    }
  }

  render() {
    const renderValues = this.getRenderValues();

    const content = html`<div
      id="content"
      ?inert=${renderValues.showingOverlay || this.uiState.blockingAction}
    >
      ${this.uiState.show.has("TOS") || this.uiState.show.has("MissingShare")
        ? nothing
        : [
            this.#renderCanvasController(renderValues),
            this.#renderAppController(renderValues),
            this.#renderWelcomePanel(),
            this.uiState.showStatusUpdateChip
              ? this.#renderStatusUpdateBar()
              : nothing,
          ]}
    </div>`;

    /**
     * bbevent is the container for most of the actions triggered within the UI.
     * It is something of a shapeshifting event, where the `eventType` property
     * indicates which precise event it is. We do it this way because otherwise
     * we end up with a vast array of named event listeners on the elements here
     * and maintenance becomes tricky.
     *
     * @see BreadboardUI.Events.StateEventDetailMap for the list of all events.
     */
    return html`<div
      id="container"
      @bbevent=${async (
        evt: BreadboardUI.Events.StateEvent<
          keyof BreadboardUI.Events.StateEventDetailMap
        >
      ) => this.handleRoutedEvent(evt)}
      @bbsnackbar=${(snackbarEvent: BreadboardUI.Events.SnackbarEvent) => {
        this.snackbar(
          snackbarEvent.message,
          snackbarEvent.snackType,
          snackbarEvent.actions,
          snackbarEvent.persistent,
          snackbarEvent.snackbarId,
          snackbarEvent.replaceAll
        );
      }}
      @bbunsnackbar=${(evt: BreadboardUI.Events.UnsnackbarEvent) => {
        this.unsnackbar(evt.snackbarId);
      }}
      @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
        this.toast(toastEvent.message, toastEvent.toastType);
      }}
      @dragover=${(evt: DragEvent) => {
        evt.preventDefault();
      }}
      @drop=${(evt: DragEvent) => {
        evt.preventDefault();
        this.attemptImportFromDrop(evt);
      }}
    >
      ${[
        this.#renderHeader(renderValues),
        content,
        this.uiState.show.has("MissingShare")
          ? this.#renderMissingShareDialog()
          : nothing,
        this.uiState.show.has("TOS") ? this.#renderTosDialog() : nothing,
        this.uiState.show.has("BoardEditModal")
          ? this.#renderBoardEditModal()
          : nothing,
        this.uiState.show.has("SnackbarDetailsModal")
          ? this.renderSnackbarDetailsModal()
          : nothing,
        this.uiState.show.has("BetterOnDesktopModal")
          ? this.#renderBetterOnDesktopModal()
          : nothing,
        this.uiState.show.has("VideoModal")
          ? this.#renderVideoModal()
          : nothing,
        this.uiState.show.has("StatusUpdateModal")
          ? this.#renderStatusUpdateModal()
          : nothing,
        this.uiState.show.has("GlobalSettings")
          ? this.#renderGlobalSettingsModal(renderValues)
          : nothing,
        this.uiState.show.has("WarmWelcome")
          ? this.#renderWarmWelcomeModal()
          : nothing,
        this.uiState.show.has("SignInModal")
          ? this.renderSignInModal()
          : nothing,
        this.renderTooltip(),
        this.#renderToasts(),
        this.renderSnackbar(),
        this.#renderFeedbackPanel(),
        this.renderConsentRequests(),
      ]}
    </div>`;
  }

  #renderWelcomePanel() {
    if (this.uiState.loadState !== "Home") {
      return nothing;
    }

    return html`<bb-project-listing
      .recentBoards=${this.runtime.board.getRecentBoards()}
    ></bb-project-listing>`;
  }

  #renderAppController(renderValues: RenderValues) {
    const graphIsEmpty = BreadboardUI.Utils.isEmpty(this.tab?.graph ?? null);
    const active =
      this.uiState.mode === "app" && this.uiState.loadState !== "Home";

    return html`<bb-app-controller
      class=${classMap({ active })}
      .graph=${this.tab?.graph ?? null}
      .graphIsEmpty=${graphIsEmpty}
      .graphTopologyUpdateId=${this.graphTopologyUpdateId}
      .isMine=${this.tab?.graphIsMine ?? false}
      .projectRun=${renderValues.projectState?.run}
      .readOnly=${true}
      .runtimeFlags=${this.uiState.flags}
      .settings=${this.settings}
      .showGDrive=${this.signinAdapter.stateSignal?.status === "signedin"}
      .status=${renderValues.tabStatus}
      .themeHash=${renderValues.themeHash}
    >
    </bb-app-controller>`;
  }

  #renderCanvasController(renderValues: RenderValues) {
    return html` <bb-canvas-controller
      ${ref(this.canvasControllerRef)}
      ?inert=${renderValues.showingOverlay}
      .canRun=${this.uiState.canRunMain}
      .editor=${this.runtime.edit.getEditor(this.tab)}
      .graph=${this.tab?.graph ?? null}
      .graphIsMine=${this.tab?.graphIsMine ?? false}
      .graphStore=${this.graphStore}
      .graphStoreUpdateId=${this.graphStoreUpdateId}
      .graphTopologyUpdateId=${this.graphTopologyUpdateId}
      .history=${this.runtime.edit.getHistory(this.tab)}
      .mainGraphId=${this.tab?.mainGraphId}
      .projectState=${renderValues.projectState}
      .readOnly=${this.tab?.readOnly ?? true}
      .selectionState=${this.selectionState}
      .settings=${this.settings}
      .signedIn=${this.signinAdapter.stateSignal?.status === "signedin"}
      .status=${renderValues.tabStatus}
      .themeHash=${renderValues.themeHash}
      .visualChangeId=${this.lastVisualChangeId}
      @bbshowvideomodal=${() => {
        this.uiState.show.add("VideoModal");
      }}
      @bbeditorpositionchange=${(
        evt: BreadboardUI.Events.EditorPointerPositionChangeEvent
      ) => {
        this.lastPointerPosition.x = evt.x;
        this.lastPointerPosition.y = evt.y;
      }}
      @bbinteraction=${() => {
        if (!this.tab) {
          return;
        }

        this.runtime.board.clearPendingBoardSave(this.tab.id);
      }}
      @bbiterateonprompt=${(iterateOnPromptEvent: IterateOnPromptEvent) => {
        const message: IterateOnPromptMessage = {
          type: "iterate_on_prompt",
          title: iterateOnPromptEvent.title,
          promptTemplate: iterateOnPromptEvent.promptTemplate,
          boardId: iterateOnPromptEvent.boardId,
          nodeId: iterateOnPromptEvent.nodeId,
          modelId: iterateOnPromptEvent.modelId,
        };
        this.embedHandler?.sendToEmbedder(message);
      }}
    ></bb-canvas-controller>`;
  }

  #renderBoardEditModal() {
    return html`<bb-edit-board-modal
      .boardTitle=${this.tab?.graph.title ?? null}
      .boardDescription=${this.tab?.graph.description ?? null}
      @bbmodaldismissed=${() => {
        this.uiState.show.delete("BoardEditModal");
      }}
    ></bb-edit-board-modal>`;
  }

  #renderBetterOnDesktopModal() {
    return html`<bb-better-on-desktop-modal
      @bbmodaldismissed=${() => {
        this.uiState.show.delete("BetterOnDesktopModal");
      }}
    ></bb-better-on-desktop-modal>`;
  }

  #renderVideoModal() {
    return html`<bb-video-modal
      @bbmodaldismissed=${() => {
        this.uiState.show.delete("VideoModal");
      }}
    ></bb-video-modal>`;
  }

  #renderStatusUpdateBar() {
    const classes: Record<string, boolean> = { "md-body-medium": true };
    const newestUpdate = this.statusUpdates.at(0);
    if (!newestUpdate) {
      return nothing;
    }

    classes[newestUpdate.type] = true;
    let icon;
    switch (newestUpdate.type) {
      case "info":
        icon = html`info`;
        break;
      case "warning":
        icon = html`warning`;
        break;
      case "urgent":
        icon = html`error`;
        break;
      default:
        icon = nothing;
        break;
    }

    return html`<div
      id="status-update-bar"
      class=${classMap(classes)}
      aria-role="button"
      @click=${() => {
        this.uiState.show.add("StatusUpdateModal");
        this.uiState.showStatusUpdateChip = false;
      }}
    >
      <div>
        <span class="g-icon round filled">${icon}</span>
        <p>${newestUpdate.text}</p>
      </div>
      <button
        class="close"
        @click=${(evt: Event) => {
          evt.preventDefault();
          evt.stopImmediatePropagation();
          this.uiState.showStatusUpdateChip = false;
        }}
      >
        <span class="g-icon round filled">close</span>
      </button>
    </div>`;
  }

  #renderStatusUpdateModal() {
    return html`<bb-status-update-modal
      .updates=${this.statusUpdates}
      @bbmodaldismissed=${() => {
        this.uiState.show.delete("StatusUpdateModal");
        this.uiState.showStatusUpdateChip = false;
      }}
    ></bb-status-update-modal>`;
  }

  #renderGlobalSettingsModal(renderValues: RenderValues) {
    return html`<bb-global-settings-modal
      .flags=${this.runtime.flags.flags()}
      .showExperimentalComponents=${renderValues.showExperimentalComponents}
      .project=${renderValues.projectState}
      .uiState=${this.uiState}
      .emailPrefsManager=${this.emailPrefsManager}
      @bbmodaldismissed=${() => {
        this.uiState.show.delete("GlobalSettings");
      }}
    ></bb-global-settings-modal>`;
  }

  #renderWarmWelcomeModal() {
    return html`<bb-warm-welcome-modal
      .emailPrefsManager=${this.emailPrefsManager}
      @bbmodaldismissed=${() => {
        this.uiState.show.delete("WarmWelcome");
      }}
    ></bb-warm-welcome-modal>`;
  }

  #renderMissingShareDialog() {
    return html`<dialog
      id="missing-share-dialog"
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }

        evt.preventDefault();
      }}
      ${ref((el: Element | undefined) => {
        const showModalIfNeeded = () => {
          if (el && this.uiState.show.has("MissingShare") && el.isConnected) {
            const dialog = el as HTMLDialogElement;
            if (!dialog.open) {
              dialog.showModal();
            }
          }
        };

        requestAnimationFrame(showModalIfNeeded);
      })}
    >
      <form method="dialog">
        <h1>Oops, something went wrong</h1>
        <p class="share-content">
          It has not been possible to open this app. Please ask the author to
          check that the app was published successfully and then try again.
        </p>
      </form>
    </dialog>`;
  }

  #renderTosDialog() {
    const tosTitle = Strings.from("TOS_TITLE");
    let tosHtml = "";
    let tosVersion = 0;
    if (!this.tosStatus || !this.tosStatus.canAccess) {
      tosHtml =
        this.tosStatus?.termsOfService?.terms ?? "Unable to retrieve TOS";
      tosVersion = this.tosStatus?.termsOfService?.version ?? 0;
    }

    return html`<dialog
      id="tos-dialog"
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }

        evt.preventDefault();
      }}
      ${ref((el: Element | undefined) => {
        const showModalIfNeeded = () => {
          if (el && this.uiState.show.has("TOS") && el.isConnected) {
            const dialog = el as HTMLDialogElement;
            if (!dialog.open) {
              dialog.showModal();
            }
          }
        };

        requestAnimationFrame(showModalIfNeeded);
      })}
    >
      <form method="dialog">
        <h1>${tosTitle}</h1>
        <div class="tos-content">${unsafeHTML(tosHtml)}</div>
        <div class="controls">
          <button
            @click=${async (evt: Event) => {
              if (!(evt.target instanceof HTMLButtonElement)) {
                return;
              }
              evt.target.disabled = true;
              await this.runtime.apiClient.acceptTos(tosVersion, true);
              this.tosStatus = await this.runtime.apiClient.checkTos();
            }}
          >
            Continue
          </button>
        </div>
      </form>
    </dialog>`;
  }

  #renderFeedbackPanel() {
    return html`
      <bb-feedback-panel ${ref(this.feedbackPanelRef)}></bb-feedback-panel>
    `;
  }

  #renderToasts() {
    return html`${map(
      this.uiState.toasts,
      ([toastId, { message, type, persistent }], idx) => {
        const offset = this.uiState.toasts.size - idx - 1;
        return html`<bb-toast
          .toastId=${toastId}
          .offset=${offset}
          .message=${message}
          .type=${type}
          .timeout=${persistent ? 0 : nothing}
          @bbtoastremoved=${(evt: BreadboardUI.Events.ToastRemovedEvent) => {
            this.uiState.toasts.delete(evt.toastId);
          }}
        ></bb-toast>`;
      }
    )}`;
  }

  #renderHeader(renderValues: RenderValues) {
    return html`<bb-ve-header
      ?inert=${renderValues.showingOverlay || this.uiState.blockingAction}
      .signinAdapter=${this.signinAdapter}
      .hasActiveTab=${this.tab !== null}
      .tabTitle=${this.tab?.graph?.title ?? null}
      .url=${this.tab?.graph?.url ?? null}
      .loadState=${this.uiState.loadState}
      .canSave=${renderValues.canSave}
      .isMine=${this.runtime.board.isMine(this.tab?.graph.url)}
      .saveStatus=${renderValues.saveStatus}
      .showExperimentalComponents=${renderValues.showExperimentalComponents}
      .mode=${this.uiState.mode}
      @bbsignout=${async () => {
        await this.signinAdapter.signOut();
        this.runtime.actionTracker.signOutSuccess();
        window.location.href = makeUrl({
          page: "landing",
          redirect: {
            page: "home",
            guestPrefixed: true,
          },
          guestPrefixed: true,
        });
      }}
      @bbclose=${async () => {
        if (!this.tab) {
          return;
        }
        this.embedHandler?.sendToEmbedder({
          type: "back_clicked",
        });
        const homepage: MakeUrlInit = {
          page: "home",
          mode: this.uiState.mode,
          dev: parsedUrl.dev,
          guestPrefixed: true,
        };
        if ((await this.signinAdapter.state) === "signedin") {
          this.runtime.router.go(homepage);
        } else {
          // Note that router.go() can't navigate to the landing page, because
          // it's a totally different entrypoint.
          window.location.assign(
            makeUrl({
              page: "landing",
              dev: parsedUrl.dev,
              redirect: homepage,
              guestPrefixed: true,
            })
          );
        }
      }}
      @bbsubscribercreditrefresh=${async () => {
        try {
          this.uiState.subscriptionCredits = -1;
          const response = await this.runtime.apiClient.getG1Credits();
          this.uiState.subscriptionCredits = response.remaining_credits ?? 0;
        } catch (err) {
          this.uiState.subscriptionCredits = -2;
          console.warn(err);
        }
      }}
      @bbsharerequested=${() => {
        if (!this.canvasControllerRef.value) {
          return;
        }

        this.canvasControllerRef.value.openSharePanel();
      }}
      @change=${async (evt: Event) => {
        const [select] = evt.composedPath();
        if (!(select instanceof BreadboardUI.Elements.ItemSelect)) {
          return;
        }

        switch (select.value) {
          case "edit-title-and-description": {
            if (!this.tab) {
              return;
            }

            this.uiState.show.add("BoardEditModal");
            break;
          }

          case "delete": {
            if (!this.tab?.graph || !this.tab.graph.url) {
              return;
            }

            this.invokeDeleteEventRouteWith(this.tab.graph.url);
            break;
          }

          case "duplicate": {
            if (!this.tab?.graph || !this.tab.graph.url) {
              return;
            }

            this.runtime.actionTracker.remixApp(this.tab.graph.url, "editor");
            this.invokeRemixEventRouteWith(this.tab.graph.url, {
              start: Strings.from("STATUS_GENERIC_WORKING"),
              end: Strings.from("STATUS_PROJECT_CREATED"),
              error: Strings.from("ERROR_GENERIC"),
            });
            break;
          }

          case "feedback": {
            if (this.globalConfig.GOOGLE_FEEDBACK_PRODUCT_ID) {
              if (this.feedbackPanelRef.value) {
                this.feedbackPanelRef.value.open();
              } else {
                console.error(`Feedback panel was not rendered!`);
              }
            }
            break;
          }

          case "chat": {
            window.open("https://discord.gg/googlelabs", "_blank");
            break;
          }

          case "documentation": {
            window.open("https://developers.google.com/opal", "_blank");
            break;
          }

          case "demo-video": {
            this.uiState.show.add("VideoModal");
            break;
          }

          case "history": {
            if (!this.canvasControllerRef.value) {
              return;
            }

            this.canvasControllerRef.value.sideNavItem = "edit-history";
            break;
          }

          case "show-global-settings": {
            this.uiState.show.add("GlobalSettings");
            break;
          }

          case "status-update": {
            this.uiState.show.add("StatusUpdateModal");
            this.uiState.showStatusUpdateChip = false;
            break;
          }

          case "copy-board-contents": {
            if (!this.tab) {
              return;
            }

            await navigator.clipboard.writeText(
              JSON.stringify(this.tab.graph, null, 2)
            );
            this.toast(
              Strings.from("STATUS_PROJECT_CONTENTS_COPIED"),
              BreadboardUI.Events.ToastType.INFORMATION
            );
            break;
          }

          default: {
            console.log("Action:", select.value);
            break;
          }
        }
      }}
    >
    </bb-ve-header>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-main": Main;
  }
}
