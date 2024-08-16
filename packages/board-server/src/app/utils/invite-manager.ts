/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import type {
  CreateInviteResponse,
  DeleteInviteResponse,
  InviteListResponse,
  VisitorState,
} from "./types.js";

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

export const inviteManagerContext =
  createContext<InviteManager>("inviteManager");

export const getGuestKey = () => {
  const url = new URL(window.location.href);
  const guestStorageKey = toGuestKey(url);
  if (guestStorageKey) {
    return globalThis.localStorage.getItem(guestStorageKey);
  }
  return null;
};

export class InviteManager {
  #url: string | null;
  #inviteList: string[] | null = null;
  #pending = false;
  #visitorState: VisitorState = "loading";
  #boardServerKey: string | null = null;
  #guestKey: string | null = null;

  constructor() {
    this.#boardServerKey = localStorage.getItem(BOARD_SERVER_KEY);
    if (!this.#boardServerKey) {
      this.#guestKey = getGuestKey();
      this.#url = null;
    } else {
      // User state is at least "user", maybe "owner".
      const inviteURL = new URL(window.location.href.replace(/app$/, "invite"));
      inviteURL.searchParams.set("API_KEY", this.#boardServerKey);
      this.#url = inviteURL.href;
    }
    this.#updateVisitorState();
  }

  boardServerKey(): string | null {
    return this.#boardServerKey;
  }

  guestKey(): string | null {
    return this.#guestKey;
  }

  async #updateVisitorState() {
    if (!this.#url) {
      this.#visitorState = this.#guestKey ? "user" : "visitor";
      return;
    }
    this.#visitorState = "loading";
    const canCreate = await this.canCreateInvite();
    this.#visitorState = canCreate ? "owner" : "user";
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
