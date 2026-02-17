/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * FIXME: Legacy event routing registry. These routes still depend on the
 * legacy runtime (e.g. runtime.project, tab, settings) which is not yet
 * available through SCA services. Migrate remaining routes to SCA actions
 * (using stateEventTrigger) once the runtime dependency is resolved, then
 * delete this file along with event-routing/types.ts.
 *
 * Remaining routes:
 *   Board:   create, delete, input, remix, run, stop, restart
 *   Flowgen: generate
 *   Node:    action
 */

import type * as BreadboardUI from "../ui/index.js";
import { EventRoute } from "./types.js";

import * as Board from "./board/board.js";
import * as Flowgen from "./flowgen/flowgen.js";
import * as Node from "./node/node.js";

export const eventRoutes = new Map<
  keyof BreadboardUI.Events.StateEventDetailMap,
  EventRoute<keyof BreadboardUI.Events.StateEventDetailMap>
>([
  /** Board */
  [Board.CreateRoute.event, Board.CreateRoute],
  [Board.DeleteRoute.event, Board.DeleteRoute],
  [Board.InputRoute.event, Board.InputRoute],
  [Board.RemixRoute.event, Board.RemixRoute],
  [Board.RunRoute.event, Board.RunRoute],
  [Board.StopRoute.event, Board.StopRoute],
  [Board.RestartRoute.event, Board.RestartRoute],

  /** Flowgen */
  [Flowgen.GenerateRoute.event, Flowgen.GenerateRoute],

  /** Node */
  [Node.ActionRoute.event, Node.ActionRoute],
]);
