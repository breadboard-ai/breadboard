/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriptor,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";

export const VALID_MESSAGE_TYPES = [
  "start",
  "input",
  "output",
  "beforehandler",
  "proxy",
  "end",
  "error",
] as const;

export type ControllerMessageType = (typeof VALID_MESSAGE_TYPES)[number];

export type RoundTrip = {
  /**
   * The id of the message.
   */
  id: string;
};

export type ControllerMessage = {
  /**
   * The id of the message.
   */
  id?: string;
  /**
   * The type of the message.
   */
  type: ControllerMessageType;
  /**
   * The data payload of the message.
   */
  data: unknown;
};

export type RoundTripControllerMessage = ControllerMessage & RoundTrip;

/**
 * The message format used to communicate between the worker and its host.
 */
export type ControllerMessageBase<
  Type extends ControllerMessageType,
  Payload,
  HasId extends RoundTrip | unknown = unknown
> = HasId & {
  /**
   * The type of the message.
   */
  type: `${Type}`;
  data: Payload;
};

export type StartMesssage = ControllerMessageBase<
  "start",
  {
    url: string;
    proxyNodes: string[];
  }
>;

export type InputRequestMessage = ControllerMessageBase<
  "input",
  { node: NodeDescriptor; inputArguments: NodeValue },
  RoundTrip
>;

export type InputResponseMessage = ControllerMessageBase<
  "input",
  NodeValue,
  RoundTrip
>;

export type BeforehandlerMessage = ControllerMessageBase<
  "beforehandler",
  { node: NodeDescriptor }
>;

export type OutputMessage = ControllerMessageBase<
  "output",
  { node: NodeDescriptor; outputs: OutputValues }
>;

export type ProxyRequestMessage = ControllerMessageBase<
  "proxy",
  { node: NodeDescriptor; inputs: InputValues },
  RoundTrip
>;

export type ProxyResponseMessage = ControllerMessageBase<
  "proxy",
  OutputValues,
  RoundTrip
>;

export type EndMessage = ControllerMessageBase<"end", unknown>;

export type ErrorMessage = ControllerMessageBase<"error", { error: string }>;
