/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type * as BreadboardUI from "@breadboard-ai/shared-ui";
import { EventRoute } from "./types.js";

import * as Host from "./host/host.js";
import * as Board from "./board/board.js";
import * as Asset from "./asset/asset.js";
import * as Node from "./node/node.js";
import * as Theme from "./theme/theme.js";

export const eventRoutes = new Map<
  keyof BreadboardUI.Events.StateEventDetailMap,
  EventRoute<keyof BreadboardUI.Events.StateEventDetailMap>
>([
  /** Host */
  [Host.ModeRoute.event, Host.ModeRoute],
  [Host.SelectionStateChangeRoute.event, Host.SelectionStateChangeRoute],
  [Host.LockRoute.event, Host.LockRoute],
  [Host.UnlockRoute.event, Host.UnlockRoute],

  /** Board */
  [Board.CreateRoute.event, Board.CreateRoute],
  [Board.DeleteRoute.event, Board.DeleteRoute],
  [Board.InputRoute.event, Board.InputRoute],
  [Board.LoadRoute.event, Board.LoadRoute],
  [Board.RemixRoute.event, Board.RemixRoute],
  [Board.RenameRoute.event, Board.RenameRoute],
  [Board.RunRoute.event, Board.RunRoute],
  [Board.StopRoute.event, Board.StopRoute],

  /** Node */
  [Node.AddWithEdgeRoute.event, Node.AddWithEdgeRoute],
  [Node.ChangeRoute.event, Node.ChangeRoute],
  [Node.MultiChangeRoute.event, Node.MultiChangeRoute],
  [Node.ChangeEdgeRoute.event, Node.ChangeEdgeRoute],
  [
    Node.ChangeEdgeAttachmentPointRoute.event,
    Node.ChangeEdgeAttachmentPointRoute,
  ],

  /** Asset */
  [Asset.ChangeEdgeRoute.event, Asset.ChangeEdgeRoute],

  /** Theme */
  [Theme.ChangeRoute.event, Theme.ChangeRoute],
  [Theme.CreateRoute.event, Theme.CreateRoute],
  [Theme.DeleteRoute.event, Theme.DeleteRoute],
  [Theme.UpdateRoute.event, Theme.UpdateRoute],
]);
