/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as BreadboardUI from "./ui/index.js";
const Strings = BreadboardUI.Strings.forSection("Global");

import { type Outcome, type UUID } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { css, html, HTMLTemplateResult, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { MainArguments } from "./types/types.js";

import "./ui/elements/overflow-menu/overflow-menu.js";

import type {
  SnackbarActionEvent,
  StateEvent,
  StateEventDetailMap,
} from "./ui/events/events.js";
import * as BBLite from "./ui/lite/lite.js";
import "./ui/lite/welcome-panel/project-listing.js";
import { SnackType } from "./ui/types/types.js";
import { scaContext } from "./sca/context/context.js";
import { sca, type SCA } from "./sca/sca.js";
import { RuntimeConfig } from "./utils/graph-types.js";

const DELETE_BOARD_MESSAGE =
  "Are you sure you want to delete this gem? This cannot be undone";
const DELETING_BOARD_MESSAGE = "Deleting gem";
const MIN_OFFSET_HEIGHT = 250;

@customElement("bb-lite-home")
export class LiteHome extends SignalWatcher(LitElement) {
  static styles = [
    BBLite.Styles.HostColorScheme.match,
    BBLite.Styles.HostIcons.icons,
    BBLite.Styles.HostBehavior.behavior,
    BBLite.Styles.HostColorsMaterial.baseColors,
    BBLite.Styles.HostType.type,
    css`
      :host {
        display: block;
        background: var(--sys-color--body-background);
      }
    `,
  ];

  @state()
  accessor compactView = false;

  @provide({ context: scaContext })
  protected accessor sca: SCA;

  /**
   * Indicates whether we're currently remixing or deleting boards.
   */
  #busy = false;

  constructor(mainArgs: MainArguments) {
    super();
    // Static deployment config
    const globalConfig = mainArgs.globalConfig;

    // Configuration provided by shell host
    const guestConfiguration = mainArgs.guestConfiguration;

    // Authentication
    const opalShell = mainArgs.shellHost;

    const config: RuntimeConfig = {
      globalConfig,
      guestConfig: guestConfiguration,
      shellHost: opalShell,
      embedHandler: mainArgs.embedHandler,
      env: mainArgs.env,
      appName: Strings.from("APP_NAME"),
      appSubName: Strings.from("SUB_APP_NAME"),
    };

    this.sca = sca(config, mainArgs.globalConfig.flags);

    const sizeDetector = window.matchMedia("(max-width: 500px)");
    const reactToScreenWidth = () => {
      if (sizeDetector.matches) {
        this.compactView = true;
      } else {
        this.compactView = false;
      }
    };
    sizeDetector.addEventListener("change", reactToScreenWidth);
    reactToScreenWidth();
    this.sca.services.actionTracker?.load("landing");
  }

  connectedCallback() {
    super.connectedCallback();
    // TODO: remove (small convenience for development)
    if (new URLSearchParams(window.location.search).get("scroll") === "true") {
      this.style.overflow = "auto";
      this.style.padding = "24px";
    }
    this.#addResizeController();
  }

  #debounceResizeNotify = 0;
  #debounceResizeAnimate = true;
  #addResizeController() {
    // Here we debounce the call to notify the embedder because we may get a
    // flurry of updates. Instead we schedule the update and, when the timeout
    // expires, we issue the update.
    const notifyResize = (debounceTimeout = 0) => {
      // In some embedding contexts the height might be initially calculated as
      // being less than the gallery height. So we effectively use this check to
      // ignore such updates.
      if (this.offsetHeight < MIN_OFFSET_HEIGHT) return;

      clearTimeout(this.#debounceResizeNotify);
      this.#debounceResizeNotify = window.setTimeout(() => {
        this.sca.services.embedHandler?.sendToEmbedder({
          type: "resize",
          width: this.offsetWidth,
          height: this.offsetHeight,
          animate: this.#debounceResizeAnimate,
        });

        // After the first notification, we no longer animate.
        this.#debounceResizeAnimate = false;
      }, debounceTimeout);
    };
    const resizeObserver = new ResizeObserver(() => notifyResize());
    resizeObserver.observe(this);
    // Send initial notification.
    notifyResize(50);
  }

  handleRoutedEvent(evt: Event) {
    const { payload } = evt as StateEvent<keyof StateEventDetailMap>;
    const { eventType } = payload;

    const maybeReportError = (outcome: Outcome<void>) => {
      if (ok(outcome)) {
        return;
      }

      const snackbarId = crypto.randomUUID();
      this.snackbar(outcome.$error, SnackType.ERROR, snackbarId);
    };

    switch (eventType) {
      case "board.delete":
        return this.deleteBoard(payload.url).then(maybeReportError);
      case "board.remix":
        return this.remixBoard(payload.url).then(maybeReportError);
      case "board.togglepin":
        return this.togglePin(payload.url).then(maybeReportError);
      case "board.load":
        return this.loadBoard(payload.url).then(maybeReportError);
      case "board.create":
        return this.createBoard().then(maybeReportError);
      default:
        console.warn("Unknown event type", eventType, payload);
        break;
    }
  }

  /**
   * Removes a URL from the recent boards list.
   * @param url -- url to remove
   */
  async removeRecentBoard(url: string) {
    await this.sca.controller.home.recent.remove(url);
  }

  async addRecentBoard(url: string, title: string) {
    url = url.replace(window.location.origin, "");
    await this.sca.controller.home.recent.add({
      title,
      url,
    });
  }

  #renderSnackbar() {
    return html`<bb-snackbar
      @bbsnackbaraction=${async (evt: SnackbarActionEvent) => {
        evt.callback?.();
      }}
    ></bb-snackbar>`;
  }

  snackbar(message: string | HTMLTemplateResult, type: SnackType, id: UUID) {
    this.sca.controller.global.snackbars.snackbar(
      message,
      type,
      [],
      false,
      id,
      true // replaceAll
    );
  }

  unsnackbar(id: UUID) {
    this.sca.controller.global.snackbars.unsnackbar(id);
  }

  async deleteBoard(url: string): Promise<Outcome<void>> {
    const boardServer = this.sca.services.googleDriveBoardServer;
    if (!boardServer) {
      return err(`Board server is undefined. Likely a misconfiguration`);
    }

    if (this.#busy) return;
    this.#busy = true;

    const snackbarId = crypto.randomUUID();
    this.snackbar(DELETING_BOARD_MESSAGE, SnackType.PENDING, snackbarId);
    try {
      if (!confirm(DELETE_BOARD_MESSAGE)) {
        return;
      }
      const result = await boardServer.delete(new URL(url));
      if (!result.result) {
        return err(result.error || `Unable to delete "${url}"`);
      }
      this.removeRecentBoard(url);
    } finally {
      this.unsnackbar(snackbarId);
      this.#busy = false;
    }
  }

  async remixBoard(urlString: string) {
    this.sca.services.embedHandler?.sendToEmbedder({
      type: "remix_board",
      boardId: urlString,
    });
  }

  async loadBoard(urlString: string) {
    this.sca.services.embedHandler?.sendToEmbedder({
      type: "load_board",
      boardId: urlString,
    });
  }

  async createBoard() {
    this.sca.services.embedHandler?.sendToEmbedder({
      type: "create_board",
    });
  }

  async togglePin(url: string) {
    url = url.replace(window.location.origin, "");
    const board = this.sca.controller.home.recent.boards.find(
      (b) => b.url === url
    );
    if (board) {
      await this.sca.controller.home.recent.setPin(url, !board.pinned);
    }
  }

  render() {
    return html`<section id="home">
      <bb-project-listing-lite
        .libraryTitle=${this.sca.services.guestConfig.libraryTitle ?? null}
        .libraryIcon=${this.sca.services.guestConfig.libraryIcon ?? null}
        .noLibraryAppsTitle=${this.sca.services.guestConfig
          .noLibraryAppsTitle ?? null}
        .galleryTitle=${this.sca.services.guestConfig.galleryTitle ?? null}
        .galleryIcon=${this.sca.services.guestConfig.galleryIcon ?? null}
        .createNewTitle=${this.sca.services.guestConfig.createNewTitle ?? null}
        .createNewIcon=${this.sca.services.guestConfig.createNewIcon ?? null}
        .allowCreate=${!this.compactView}
        @bbevent=${this.handleRoutedEvent}
      ></bb-project-listing-lite>
      ${this.#renderSnackbar()}
    </section>`;
  }
}
