/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type * as BreadboardUI from "../ui/index.js";
import { EventRoute } from "./types.js";

import * as Host from "./host/host.js";
import * as Board from "./board/board.js";
import * as Asset from "./asset/asset.js";
import * as Node from "./node/node.js";

export const eventRoutes = new Map<
  keyof BreadboardUI.Events.StateEventDetailMap,
  EventRoute<keyof BreadboardUI.Events.StateEventDetailMap>
>([
  /** Host */
  [Host.ModeRoute.event, Host.ModeRoute],
  [Host.SelectionStateChangeRoute.event, Host.SelectionStateChangeRoute],
  [Host.LockRoute.event, Host.LockRoute],
  [Host.UnlockRoute.event, Host.UnlockRoute],
  [Host.FlagChangeRoute.event, Host.FlagChangeRoute],
  [Host.UserSignInRoute.event, Host.UserSignInRoute],

  /** Board */
  [Board.CreateRoute.event, Board.CreateRoute],
  [Board.DeleteRoute.event, Board.DeleteRoute],
  [Board.InputRoute.event, Board.InputRoute],
  [Board.LoadRoute.event, Board.LoadRoute],
  [Board.RemixRoute.event, Board.RemixRoute],
  [Board.RenameRoute.event, Board.RenameRoute],
  [Board.RunRoute.event, Board.RunRoute],
  [Board.StopRoute.event, Board.StopRoute],
  [Board.RestartRoute.event, Board.RestartRoute],
  [Board.ReplaceRoute.event, Board.ReplaceRoute],
  [Board.TogglePinRoute.event, Board.TogglePinRoute],
  [Board.UndoRoute.event, Board.UndoRoute],
  [Board.RedoRoute.event, Board.RedoRoute],

  /** Node */
  [Node.ActionRoute.event, Node.ActionRoute],
  [Node.AddRoute.event, Node.AddRoute],
  [Node.ChangeRoute.event, Node.ChangeRoute],
  [Node.MoveSelectionRoute.event, Node.MoveSelectionRoute],
  [Node.ChangeEdgeRoute.event, Node.ChangeEdgeRoute],
  [
    Node.ChangeEdgeAttachmentPointRoute.event,
    Node.ChangeEdgeAttachmentPointRoute,
  ],

  /** Asset */
  [Asset.AddRoute.event, Asset.AddRoute],
  [Asset.ChangeEdgeRoute.event, Asset.ChangeEdgeRoute],
]);
