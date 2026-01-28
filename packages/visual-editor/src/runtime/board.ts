/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BoardServerSaveEventStatus,
  GraphLoader,
  MutableGraphStore,
} from "@breadboard-ai/types";
import * as BreadboardUI from "../ui/index.js";
import { BOARD_SAVE_STATUS } from "../ui/types/types.js";
import type { SigninAdapter } from "../ui/utils/signin-adapter.js";
import {
  RuntimeBoardSaveStatusChangeEvent,
  RuntimeTabChangeEvent,
  RuntimeTabCloseEvent,
} from "./events.js";
import { Tab, TabId } from "./types.js";
import { GoogleDriveBoardServer } from "../board-server/server.js";
import { parseUrl } from "../ui/utils/urls.js";
import { SCA } from "../sca/sca.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

const documentStyles = getComputedStyle(document.documentElement);

type ValidColorStrings = `#${string}` | `--${string}`;

export function getGlobalColor(
  name: ValidColorStrings,
  defaultValue: ValidColorStrings = "#333333"
) {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  const valueAsNumber = parseInt(value || defaultValue, 16);
  if (Number.isNaN(valueAsNumber)) {
    return 0xff00ff;
  }
  return valueAsNumber;
}

export class Board extends EventTarget {
  #tabs = new Map<TabId, Tab>();
  #currentTabId: TabId | null = null;

  constructor(
    public readonly loader: GraphLoader,
    public readonly graphStore: MutableGraphStore,
    public readonly googleDriveBoardServer: GoogleDriveBoardServer,
    _signinAdapter: SigninAdapter,
    _googleDriveClient?: GoogleDriveClient,
    /** Here for migrations */
    private readonly __sca?: SCA
  ) {
    super();
    this.googleDriveBoardServer.addEventListener(
      "savestatuschange",
      ({ url, status }) => {
        // Get current graph info from SCA controller
        const currentId = this.__sca?.controller.editor.graph.id ?? null;
        const currentUrl = this.__sca?.controller.editor.graph.url ?? null;

        if (!currentId || currentUrl !== url) {
          return;
        }

        this.#tabSaveStatus.set(currentId, toSaveStatus(status));
        this.dispatchEvent(new RuntimeBoardSaveStatusChangeEvent());
      }
    );
  }

  currentURL: URL | null = null;

  get tabs() {
    return this.#tabs;
  }

  getTabURLs(): string[] {
    return [...this.#tabs.values()]
      .filter((tab) => tab.graph.url !== undefined)
      .map((tab) => tab.graph.url as string);
  }

  getBoardURL(url: URL): string | undefined {
    const parsed = parseUrl(url);
    return parsed.page === "graph" ? parsed.flow : undefined;
  }

  closeTab(id: TabId) {
    let nextTab = null;

    const tabList = [...this.#tabs.keys()];
    for (let t = 0; t < tabList.length; t++) {
      if (tabList[t] !== id) {
        continue;
      }

      if (t === 0 && tabList.length > 1) {
        nextTab = tabList[t + 1];
        break;
      }

      if (t > 0) {
        nextTab = tabList[t - 1];
        break;
      }
    }

    if (this.__sca) {
      this.__sca.controller.editor.graph.resetAll();
    }

    this.#tabs.delete(id);
    this.dispatchEvent(new RuntimeTabCloseEvent(id));

    if (id !== this.#currentTabId) {
      return;
    }

    this.#currentTabId = nextTab;
    this.dispatchEvent(new RuntimeTabChangeEvent());
  }

  canSave(id: TabId | null): boolean {
    if (!id) {
      return false;
    }

    const tab = this.#tabs.get(id);
    if (!tab) {
      return false;
    }

    if (!tab.graph || !tab.graph.url) {
      return false;
    }

    const boardUrl = new URL(tab.graph.url);
    const boardServer = this.googleDriveBoardServer;
    if (!boardServer) {
      return false;
    }

    const capabilities = boardServer.canProvide(boardUrl);
    return capabilities && capabilities.save;
  }

  isMine(url: string | undefined): boolean {
    if (!url) {
      return false;
    }

    const boardUrl = new URL(url);
    const boardServer = this.googleDriveBoardServer;
    if (!boardServer) {
      return false;
    }
    return boardServer.isMine(boardUrl);
  }

  #tabSaveId = new Map<
    TabId,
    ReturnType<typeof globalThis.crypto.randomUUID>
  >();
  #tabSaveStatus = new Map<TabId, BreadboardUI.Types.BOARD_SAVE_STATUS>();

  saveStatus(id: TabId) {
    return this.#tabSaveStatus.get(id);
  }

  clearSaveStatus(id: TabId) {
    this.#tabSaveStatus.delete(id);
  }

  clearPendingBoardSave(id: TabId) {
    this.#tabSaveId.delete(id);
  }
}

function toSaveStatus(status: BoardServerSaveEventStatus): BOARD_SAVE_STATUS {
  let result;

  switch (status) {
    case "saving":
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVING;
      break;
    case "idle":
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED;
      break;
    case "debouncing":
    case "queued":
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.UNSAVED;
      break;
    default:
      result = BreadboardUI.Types.BOARD_SAVE_STATUS.SAVED;
      break;
  }
  return result;
}
