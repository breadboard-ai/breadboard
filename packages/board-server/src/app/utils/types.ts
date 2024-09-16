/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TypedEventTarget } from "@google-labs/breadboard";

export type InviteListResponse =
  | { success: true; invites: string[] }
  | { success: false; error: string };

export type CreateInviteResponse =
  | { success: true; invite: string }
  | { success: false; error: string };

export type DeleteInviteResponse =
  | { success: true; deleted: string }
  | { success: false; error: string };

export enum VisitorState {
  /**
   * The user state is not yet known.
   */
  LOADING,
  /**
   * The user is not signed in and has no active invite.
   * Can't run boards on the board server, can't manage invites.
   * Can update the board server key, which may change the state.
   */
  VISITOR,
  /**
   * The user accepted invite.
   * Can run boards on the board server.
   * Can't manage invites.
   * Can add the board server key, which may change the state.
   */
  INVITEE,
  /**
   * The user is signed in or invite is active.
   * Can run boards on the board server, but can't manage invites.
   * Can update the board server key, which may change the state.
   */
  USER,
  /**
   * The user is signed in and is the owner of the board. Can do everything
   * that the "user" can do, plus manage invites.
   */
  OWNER,
}

export type VisitorStateChangeEvent = Event & {
  state: VisitorState;
  previous: VisitorState;
};

export type VisitorStateEventMap = {
  change: VisitorStateChangeEvent;
};

export type VisitorStateEventTarget = TypedEventTarget<VisitorStateEventMap>;
