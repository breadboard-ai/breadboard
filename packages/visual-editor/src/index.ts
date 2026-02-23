/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ref } from "lit/directives/ref.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { MainBase, RenderValues } from "./main-base.js";
import { IterateOnPromptMessage } from "./ui/embed/embed.js";
import { IterateOnPromptEvent } from "./ui/events/events.js";
import * as BreadboardUI from "./ui/index.js";
import { makeUrl, parseUrl } from "./ui/navigation/urls.js";

import { CheckAppAccessResult } from "@breadboard-ai/types/opal-shell-protocol.js";
import { MakeUrlInit } from "./sca/types.js";
import { repeat } from "lit/directives/repeat.js";
import { Utils } from "./sca/utils.js";

// Build constant.
declare const ENABLE_DEBUG_TOOLING: boolean;

const Strings = BreadboardUI.Strings.forSection("Global");
const parsedUrl = parseUrl(window.location.href);

export { Main };

@customElement("bb-main")
class Main extends MainBase {
  override async doPostInitWork() {
    await Promise.all([
      this.sca.controller.global.performMigrations(),
      this.sca.controller.global.debug.isHydrated,
    ]);

    this.maybeNotifyAboutPreferredUrlForDomain();
    this.addExperimentalToggleToWindow();
  }

  private addExperimentalToggleToWindow() {
    const guestWindow = globalThis.window as unknown as {
      toggleExperimentalFeatures(): Promise<unknown>;
      downloadAgentTraces(): object;
      getAgentRuns(): unknown[];
    };
    guestWindow.toggleExperimentalFeatures = async () => {
      // Ignore the call if the value is still hydrating.
      if (
        Utils.Helpers.isHydrating(
          () => this.sca.controller.global.main.experimentalComponents
        )
      ) {
        return;
      }

      // Toggle the value and await the set.
      this.sca.controller.global.main.experimentalComponents =
        !this.sca.controller.global.main.experimentalComponents;
      await this.sca.controller.global.main.isSettled;

      // Inform the user.
      const logger = Utils.Logging.getLogger();
      logger.logItem(
        "info",
        "",
        "Experimental Features",
        false,
        this.sca.controller.global.main.experimentalComponents
          ? "Enabled"
          : "Disabled"
      );

      return this.sca.controller.global.main.experimentalComponents.valueOf();
    };

    guestWindow.downloadAgentTraces = () => {
      const traces = this.sca.services.agentContext.exportTraces();
      const blob = new Blob([JSON.stringify(traces, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agent-traces-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return traces;
    };

    guestWindow.getAgentRuns = () => {
      return this.sca.services.agentContext.getAllRuns();
    };
  }

  async maybeNotifyAboutPreferredUrlForDomain() {
    const domain = await this.sca.services.signinAdapter.domain;
    if (!domain) {
      return;
    }
    const url = this.sca.services.globalConfig.domains?.[domain]?.preferredUrl;
    if (!url) {
      return;
    }

    this.sca.controller.global.snackbars.snackbar(
      html`
        Users from ${domain} should prefer
        <a href="${url}" target="_blank">${new URL(url).hostname}</a>
      `,
      BreadboardUI.Types.SnackType.WARNING,
      [],
      true
    );
  }

  override async handleAppAccessCheckResult(
    result: CheckAppAccessResult
  ): Promise<void> {
    this.sca.services.actionTracker.updateCanAccessStatus(result.canAccess);
    if (!result.canAccess) {
      await this.sca.services.signinAdapter.signOut();
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
      ?inert=${renderValues.showingOverlay ||
      this.sca.controller.global.main.blockingAction}
    >
      ${this.sca.controller.global.main.show.has("TOS") ||
      this.sca.controller.global.main.show.has("MissingShare")
        ? nothing
        : [
            this.#renderCanvasController(renderValues),
            this.#renderAppController(renderValues),
            this.#renderWelcomePanel(),
            this.sca.controller.global.statusUpdates.showStatusUpdateChip
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
        this.sca.controller.global.snackbars.snackbar(
          snackbarEvent.message,
          snackbarEvent.snackType,
          snackbarEvent.actions,
          snackbarEvent.persistent,
          snackbarEvent.snackbarId,
          snackbarEvent.replaceAll
        );
      }}
      @bbunsnackbar=${(evt: BreadboardUI.Events.UnsnackbarEvent) => {
        this.sca.controller.global.snackbars.unsnackbar(evt.snackbarId);
      }}
      @bbtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
        this.sca.controller.global.toasts.toast(
          toastEvent.message,
          toastEvent.toastType
        );
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
        this.sca.controller.global.main.show.has("MissingShare")
          ? this.#renderMissingShareDialog()
          : nothing,
        this.sca.controller.global.main.show.has("TOS")
          ? this.#renderTosDialog()
          : nothing,
        this.sca.controller.global.main.show.has("BoardEditModal")
          ? this.#renderBoardEditModal()
          : nothing,
        this.sca.controller.global.main.show.has("SnackbarDetailsModal")
          ? this.renderSnackbarDetailsModal()
          : nothing,
        this.sca.controller.global.main.show.has("VideoModal")
          ? this.#renderVideoModal()
          : nothing,
        this.sca.controller.global.main.show.has("StatusUpdateModal")
          ? this.#renderStatusUpdateModal()
          : nothing,
        this.sca.controller.global.main.show.has("GlobalSettings")
          ? this.#renderGlobalSettingsModal()
          : nothing,
        this.sca.controller.global.main.show.has("WarmWelcome")
          ? this.#renderWarmWelcomeModal()
          : nothing,
        this.sca.controller.global.main.show.has("SignInModal")
          ? this.renderSignInModal()
          : nothing,
        this.renderTooltip(),
        this.#renderToasts(),
        this.renderSnackbar(),
        this.renderNotebookLmPicker(),
        this.#renderFeedbackPanel(),
        this.renderConsentRequests(),
        this.#maybeRenderDebugPanel(),
      ]}
    </div>`;
  }

  #maybeRenderDebugPanel() {
    if (typeof ENABLE_DEBUG_TOOLING !== "undefined" && !ENABLE_DEBUG_TOOLING) {
      return nothing;
    }

    // TODO: Reenable this.
    // if (this.sca.controller.debug.enabled) {
    //   addDebugPanel(this.sca.controller);
    // } else {
    //   removeDebugPanel();
    // }

    return nothing;
  }

  #renderWelcomePanel() {
    if (this.sca.controller.global.main.loadState !== "Home") {
      return nothing;
    }

    return html`<bb-project-listing></bb-project-listing>`;
  }

  #renderAppController(renderValues: RenderValues) {
    const gc = this.sca.controller.editor.graph;
    const graphContentState = gc.graphContentState;
    const active =
      this.sca.controller.global.main.mode === "app" &&
      this.sca.controller.global.main.loadState !== "Home";

    return html`<bb-app-controller
      class=${classMap({ active })}
      .graph=${gc.graph ?? null}
      .graphContentState=${graphContentState}
      .graphTopologyUpdateId=${this.graphTopologyUpdateId}
      .isMine=${!gc.readOnly}
      .readOnly=${true}
      .runtimeFlags=${this.sca.controller.global.flags}
      .showGDrive=${this.sca.services.signinAdapter.stateSignal?.status ===
      "signedin"}
      .status=${renderValues.runStatus}
      .themeHash=${this.sca.controller.editor.theme.themeHash}
    >
    </bb-app-controller>`;
  }

  #renderCanvasController(renderValues: RenderValues) {
    // Temporarily block rendering the canvas for non-owners until sharing
    // initializes, so the editor doesn't flash before a potential redirect to
    // app mode due to the "allow access to editor view and remix" checkbox.
    const { graph, share } = this.sca.controller.editor;
    if (
      this.sca.controller.global.main.mode === "canvas" &&
      graph.url &&
      !this.sca.services.googleDriveBoardServer.isMine(new URL(graph.url)) &&
      share.status === "initializing"
    ) {
      return nothing;
    }
    return html` <bb-canvas-controller
      ${ref(this.canvasControllerRef)}
      ?inert=${renderValues.showingOverlay}
      .graphTopologyUpdateId=${this.graphTopologyUpdateId}
      @bbshowvideomodal=${() => {
        this.sca.controller.global.main.show.add("VideoModal");
      }}
      @bbeditorpositionchange=${(
        evt: BreadboardUI.Events.EditorPointerPositionChangeEvent
      ) => {
        this.lastPointerPosition.x = evt.x;
        this.lastPointerPosition.y = evt.y;
        this.sca.controller.global.main.pointerLocation.x = evt.x;
        this.sca.controller.global.main.pointerLocation.y = evt.y;
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
        this.sca.services.embedHandler?.sendToEmbedder(message);
      }}
    ></bb-canvas-controller>`;
  }

  #renderBoardEditModal() {
    const gc = this.sca.controller.editor.graph;
    return html`<bb-edit-board-modal
      .boardTitle=${gc.title ?? null}
      .boardDescription=${gc.graph?.description ?? null}
      @bbmodaldismissed=${() => {
        this.sca.controller.global.main.show.delete("BoardEditModal");
      }}
    >
    </bb-edit-board-modal>`;
  }

  #renderVideoModal() {
    return html`<bb-video-modal
      @bbmodaldismissed=${() => {
        this.sca.controller.global.main.show.delete("VideoModal");
      }}
    ></bb-video-modal>`;
  }

  #renderStatusUpdateBar() {
    const classes: Record<string, boolean> = { "md-body-medium": true };
    const newestUpdate = this.sca.controller.global.statusUpdates.updates.at(0);
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
        this.sca.controller.global.main.show.add("StatusUpdateModal");
        this.sca.controller.global.statusUpdates.showStatusUpdateChip = false;
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
          this.sca.controller.global.statusUpdates.showStatusUpdateChip = false;
        }}
      >
        <span class="g-icon round filled">close</span>
      </button>
    </div>`;
  }

  #renderStatusUpdateModal() {
    return html`<bb-status-update-modal
      .updates=${this.sca.controller.global.statusUpdates.updates}
      @bbmodaldismissed=${() => {
        this.sca.controller.global.main.show.delete("StatusUpdateModal");
        this.sca.controller.global.statusUpdates.showStatusUpdateChip = false;
      }}
    ></bb-status-update-modal>`;
  }

  #renderGlobalSettingsModal() {
    return html`<bb-global-settings-modal
      .flags=${this.sca.controller.global.flags.flags()}
      .uiState=${this.sca.controller.global.main}
      .emailPrefsManager=${this.sca.services.emailPrefsManager}
      .initialTab=${this.sca.controller.global.main.globalSettingsTab}
      @bbmodaldismissed=${() => {
        this.sca.controller.global.main.globalSettingsTab = null;
        this.sca.controller.global.main.show.delete("GlobalSettings");
      }}
    >
    </bb-global-settings-modal>`;
  }

  #renderWarmWelcomeModal() {
    return html`<bb-warm-welcome-modal
      .emailPrefsManager=${this.sca.services.emailPrefsManager}
      @bbmodaldismissed=${() => {
        this.sca.controller.global.main.show.delete("WarmWelcome");
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
          if (
            el &&
            this.sca.controller.global.main.show.has("MissingShare") &&
            el.isConnected
          ) {
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
          if (
            el &&
            this.sca.controller.global.main.show.has("TOS") &&
            el.isConnected
          ) {
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
              await this.sca.services.apiClient.acceptTos(tosVersion, true);
              this.tosStatus = await this.sca.services.apiClient.checkTos();
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
    if (
      Utils.Helpers.isHydrating(() => this.sca.controller.global.toasts.toasts)
    )
      return nothing;

    const toastCount = this.sca.controller.global.toasts.toasts.size;
    return html`${repeat(
      this.sca.controller.global.toasts.toasts,
      ([toastId]) => toastId,
      ([toastId, toast], idx) => {
        const offset = toastCount - idx - 1;
        return html`<bb-toast
          .toastId=${toastId}
          .offset=${offset}
          .message=${toast.message}
          .type=${toast.type}
          .closing=${toast.state === "closing"}
        ></bb-toast>`;
      }
    )}`;
  }

  #renderHeader(renderValues: RenderValues) {
    const gc = this.sca.controller.editor.graph;
    return html`<bb-ve-header
      ?inert=${renderValues.showingOverlay ||
      this.sca.controller.global.main.blockingAction}
      .signinAdapter=${this.sca.services.signinAdapter}
      .url=${gc.url ?? null}
      .loadState=${this.sca.controller.global.main.loadState}
      .canSave=${renderValues.canSave}
      .isMine=${gc.url
        ? this.sca.services.googleDriveBoardServer.isMine(new URL(gc.url))
        : false}
      .saveStatus=${renderValues.saveStatus}
      .mode=${this.sca.controller.global.main.mode}
      .graphContentState=${gc.graphContentState}
      @bbsignout=${async () => {
        await this.sca.services.signinAdapter.signOut();
        this.sca.services.actionTracker.signOutSuccess();
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
        if (!gc.graph) {
          return;
        }
        this.sca.services.embedHandler?.sendToEmbedder({
          type: "back_clicked",
        });
        const homepage: MakeUrlInit = {
          page: "home",
          dev: parsedUrl.dev,
          guestPrefixed: true,
        };
        if ((await this.sca.services.signinAdapter.state) === "signedin") {
          this.sca.controller.router.go(homepage);
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
          this.sca.controller.global.main.subscriptionCredits = -1;
          const response = await this.sca.services.apiClient.getG1Credits();
          this.sca.controller.global.main.subscriptionCredits =
            response.remainingCredits ?? 0;
        } catch (err) {
          this.sca.controller.global.main.subscriptionCredits = -2;
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
            if (!gc.graph) {
              return;
            }

            this.sca.controller.global.main.show.add("BoardEditModal");
            break;
          }

          case "delete": {
            if (!gc.graph || !gc.url) {
              return;
            }

            this.invokeDeleteEventRouteWith(gc.url);
            break;
          }

          case "duplicate": {
            if (!gc.graph || !gc.url) {
              return;
            }

            this.sca.services.actionTracker.remixApp(gc.url, "editor");
            this.invokeRemixEventRouteWith(gc.url, {
              start: Strings.from("STATUS_GENERIC_WORKING"),
              end: Strings.from("STATUS_PROJECT_CREATED"),
              error: Strings.from("ERROR_GENERIC"),
            });
            break;
          }

          case "feedback": {
            this.sca.controller.global.feedback.open(
              this.sca.services.globalConfig
            );
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
            this.sca.controller.global.main.show.add("VideoModal");
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
            this.sca.controller.global.main.show.add("GlobalSettings");
            break;
          }

          case "status-update": {
            this.sca.controller.global.main.show.add("StatusUpdateModal");
            this.sca.controller.global.statusUpdates.showStatusUpdateChip = false;
            break;
          }

          case "copy-board-contents": {
            if (!gc.graph) {
              return;
            }

            await navigator.clipboard.writeText(
              JSON.stringify(gc.graph, null, 2)
            );
            this.sca.controller.global.toasts.toast(
              Strings.from("STATUS_PROJECT_CONTENTS_COPIED"),
              BreadboardUI.Events.ToastType.INFORMATION
            );
            break;
          }

          case "share": {
            this.canvasControllerRef.value?.openSharePanel();
            break;
          }

          case "remix": {
            if (!gc.url) {
              return;
            }
            this.sca.services.actionTracker.remixApp(gc.url, "editor");
            this.invokeRemixEventRouteWith(gc.url, {
              start: Strings.from("STATUS_REMIXING_PROJECT"),
              end: Strings.from("STATUS_PROJECT_CREATED"),
              error: Strings.from("ERROR_UNABLE_TO_CREATE_PROJECT"),
            });
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
