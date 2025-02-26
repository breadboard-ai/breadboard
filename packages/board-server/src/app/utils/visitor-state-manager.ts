/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import {
  VisitorState,
  type CreateInviteResponse,
  type DeleteInviteResponse,
  type InviteListResponse,
  type VisitorStateChangeEvent,
  type VisitorStateEventTarget,
} from "./types.js";
import type { GraphDescriptor } from "@breadboard-ai/types";

const GUEST_KEY_PREFIX = "bb-guest-key-";
const BOARD_SERVER_KEY = "board-server-key";

const toBoardInfo = (url: URL) => {
  const path = url.pathname.slice(1);
  const [, userStore, boardName] = path.split("/");
  if (!userStore || userStore[0] !== "@") {
    return {};
  }
  return { userStore: userStore.slice(1), boardName };
};

export const toGuestKey = (url: URL) => {
  const { userStore, boardName } = toBoardInfo(url);
  if (!userStore || !boardName) {
    return undefined;
  }
  return `${GUEST_KEY_PREFIX}${userStore}/${boardName}`;
};

export const visitorStateManagerContext = createContext<VisitorStateManager>(
  "visitorStateManager"
);

export const getGuestKey = () => {
  const url = new URL(window.location.href);
  const guestStorageKey = toGuestKey(url);
  if (guestStorageKey) {
    return globalThis.localStorage.getItem(guestStorageKey);
  }
  return null;
};

const opts = {
  composed: true,
  bubbles: false,
  cancelable: true,
};

class ChangeEvent extends Event implements VisitorStateChangeEvent {
  static readonly eventName = "change";

  constructor(
    public state: VisitorState,
    public previous: VisitorState
  ) {
    super(ChangeEvent.eventName, { ...opts });
  }
}

export class VisitorStateManager extends (EventTarget as VisitorStateEventTarget) {
  #url: string | null;
  #inviteList: string[] | null = null;
  #pending = false;
  #visitorState: VisitorState = VisitorState.LOADING;
  /**
   * The API key for the board server. If this is set, the user is at least a
   * "user".
   */
  #boardServerApiKey: string | null = null;
  /**
   * The invite key for the guest. If this is set, the user is an
   * "invitee". Both this and #boardServerApiKey can not be set at the
   * same time.
   */
  #guestKey: string | null = null;

  constructor() {
    super();
    this.#boardServerApiKey = localStorage.getItem(BOARD_SERVER_KEY);
    if (!this.#boardServerApiKey) {
      this.#guestKey = getGuestKey();
      this.#url = null;
    } else {
      this.#url = this.#createInviteManagementApiUrl();
    }
  }

  #createInviteManagementApiUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    const inviteURL = new URL(url.href.replace(/app$/, "invite"));
    inviteURL.searchParams.set("API_KEY", this.#boardServerApiKey!);
    return inviteURL.href;
  }

  async getBoardInfo(boardURl: string) {
    const url = new URL(boardURl, window.location.href);
    url.searchParams.set("API_KEY", this.#boardServerApiKey!);
    try {
      const response = await fetch(url);
      const graph = (await response.json()) as GraphDescriptor;
      return graph;
    } catch (err) {
      console.warn(err);
    }
    return null;
  }

  boardServerKey(): string | null {
    return this.#boardServerApiKey || this.#guestKey;
  }

  #checkForInvite() {
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    if (!invite) {
      return;
    }

    const guestStorageKey = toGuestKey(url);
    if (!guestStorageKey) {
      // This is not a valid board URL. Something has gone wrong, let's bail.
      return;
    }

    // update the URL to remove the invite without changing history
    url.searchParams.delete("invite");
    history.replaceState(null, "", url.toString());

    // store the invite in local storage
    globalThis.localStorage.setItem(guestStorageKey, invite);
    this.#guestKey = invite;
  }

  async #updateVisitorState() {
    const previousState = this.#visitorState;
    if (!this.#boardServerApiKey) {
      this.#visitorState = this.#guestKey
        ? VisitorState.INVITEE
        : VisitorState.VISITOR;
    } else {
      this.#visitorState = VisitorState.LOADING;
      const canCreate = await this.canCreateInvite();
      this.#visitorState = canCreate ? VisitorState.OWNER : VisitorState.USER;
    }
    if (previousState === this.#visitorState) {
      return;
    }
    this.dispatchEvent(new ChangeEvent(this.#visitorState, previousState));
  }

  async init(): Promise<void> {
    this.#checkForInvite();
    await this.#updateVisitorState();
  }

  expireInvite() {
    const guestStorageKey = toGuestKey(new URL(window.location.href));
    if (!guestStorageKey) {
      return;
    }

    globalThis.localStorage.removeItem(guestStorageKey);
    this.#guestKey = null;
    this.#updateVisitorState();
  }

  boardServerApiKey(): string | null {
    return this.#boardServerApiKey;
  }

  setBoardServerApiKey(key: string) {
    if (key === "") {
      this.#boardServerApiKey = null;
      this.#guestKey = getGuestKey();
      this.#url = null;
      globalThis.localStorage.removeItem(BOARD_SERVER_KEY);
    } else {
      this.#boardServerApiKey = key;
      this.#url = this.#createInviteManagementApiUrl();
      this.#guestKey = null;
      globalThis.localStorage.setItem(BOARD_SERVER_KEY, key);
    }
    this.#updateVisitorState();
  }

  visitorState(): VisitorState {
    return this.#visitorState;
  }

  url(): string | null {
    return this.#url;
  }

  inviteUrl(invite: string): string {
    const inviteURL = new URL(window.location.href);
    // Just in case.
    inviteURL.searchParams.delete("API_KEY");
    inviteURL.searchParams.set("invite", invite);
    return inviteURL.href;
  }

  async listInvites(): Promise<InviteListResponse> {
    if (!this.#url) {
      return { success: false, error: "No board server key" };
    }
    if (this.#pending) {
      return { success: false, error: "Request already pending" };
    }
    if (this.#inviteList !== null) {
      return { success: true, invites: this.#inviteList };
    }
    this.#pending = true;
    try {
      const result = await fetch(this.#url, { credentials: "include" });
      const json = await result.json();
      if ("error" in json) {
        return { success: false, error: json.error };
      }
      this.#inviteList = json.invites;
      this.#pending = false;
      return { success: true, ...json };
    } catch (e) {
      this.#pending = false;
      return { success: false, error: (e as Error).message };
    }
  }

  async canCreateInvite(): Promise<boolean> {
    const result = await this.listInvites();
    return result.success;
  }

  async createInvite(): Promise<CreateInviteResponse> {
    if (!this.#url) {
      return { success: false, error: "No board server key" };
    }
    try {
      const response = await fetch(this.#url, {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      this.#inviteList = null;
      return { success: true, invite: result.invite };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  /**
   * Same as createInvite, but if an invite already exists, it will return that
   * instead of creating a new one.
   */
  async getOrCreateInvite(): Promise<CreateInviteResponse> {
    const invites = await this.listInvites();
    if (invites.success && invites.invites.length > 0) {
      return { success: true, invite: invites.invites[0] as string };
    }
    return this.createInvite();
  }

  async deleteInvite(invite: string): Promise<DeleteInviteResponse> {
    if (!this.#url) {
      return { success: false, error: "No board server key" };
    }
    try {
      const response = await fetch(this.#url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ delete: invite }),
      });
      const result = await response.json();
      this.#inviteList = null;
      return result;
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
