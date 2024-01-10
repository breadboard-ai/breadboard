/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorResponse, LoadRequest } from "../remote/protocol.js";

export const VALID_MESSAGE_TYPES = ["load", "error"] as const;

export type ControllerMessageType = (typeof VALID_MESSAGE_TYPES)[number];

export type ControllerMessage = {
  id?: string;
  type: ControllerMessageType;
  data: unknown;
};

/**
 * The message that is sent by the host to the worker to request
 * loading the board.
 */
export type LoadRequestMessage = {
  /**
   * The "load" type signals to the worker that it should load the board.
   */
  type: "load";
  data: LoadRequest;
};

/**
 * The message that is sent by the worker to the host when the board
 * encounters an error.
 */
export type ErrorMessage = {
  /**
   * The "error" type signals to the host that the board encountered an error.
   */
  type: "error";
  data: ErrorResponse;
};
