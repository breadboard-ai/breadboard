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
import { RuntimeBoardSaveStatusChangeEvent } from "./events.js";
import { TabId } from "./types.js";
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

  getBoardURL(url: URL): string | undefined {
    const parsed = parseUrl(url);
    return parsed.page === "graph" ? parsed.flow : undefined;
  }

  canSave(id: TabId | null): boolean {
    if (!id) {
      return false;
    }

    // Get graph URL from SCA controller
    const graphUrl = this.__sca?.controller.editor.graph.url ?? null;
    if (!graphUrl) {
      return false;
    }

    const boardUrl = new URL(graphUrl);
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
