/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriptor,
  NodeValue,
  OutputValues,
} from "../types.js";

export const VALID_MESSAGE_TYPES = [
  "load",
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
  id: string;
};

export type ControllerMessage = {
  id?: string;
  type: ControllerMessageType;
  data: unknown;
};

export type RoundTripControllerMessage = ControllerMessage & RoundTrip;

export type ControllerMessageBase<
  Type extends ControllerMessageType,
  Payload,
  HasId extends RoundTrip | unknown = unknown
> = HasId & {
  type: `${Type}`;
  data: Payload;
};

/**
 * The message that is sent by the host to the worker to request
 * loading the board.
 */
export type LoadRequestMessage = {
  /**
   * id of the message.
   */
  id: string;
  /**
   * The "load" type signals to the worker that it should load the board.
   */
  type: "load";
  data: {
    /**
     * The url of the board to load.
     */
    url: string;
    /**
     * The list of nodes to proxy.
     */
    proxyNodes: string[];
  };
};

/**
 * The message that is sent by the worker to the host after it loaded the board.
 */
export type LoadResponseMessage = {
  /**
   * The id of the message.
   */
  id: string;
  /**
   * The "load" type signals to the host that the worker is responding to a
   * load request.
   */
  type: "load";
  data: {
    /**
     * The title of the graph.
     */
    title?: string;
    /**
     * The description of the graph.
     */
    description?: string;
    /**
     * Version of the graph.
     * [semver](https://semver.org/) format is encouraged.
     */
    version?: string;
    /**
     * The Mermaid diagram of the graph.
     */
    diagram?: string;
    /**
     * The url of the graph.
     */
    url?: string;
  };
};

/**
 * The message that sent by the host to the worker to start the board.
 */
export type StartMesssage = {
  /**
   * The "start" type signals to the worker that it should start the board.
   */
  type: "start";
  data: unknown;
};

/**
 * The message that is sent by the worker to the host when the board
 * requests input.
 */
export type InputRequestMessage = {
  /**
   * The id of the message.
   */
  id: string;
  /**
   * The "input" type signals to the host that the board is requesting input.
   */
  type: "input";
  data: {
    /**
     * The description of the node that is requesting input.
     * @see [NodeDescriptor]
     */
    node: NodeDescriptor;
    /**
     * The input arguments that were given to the node that is requesting input.
     * These arguments typically contain the schema of the inputs that are
     * expected.
     * @see [InputValues]
     */
    inputArguments: InputValues;
  };
};

/**
 * The message that is sent by the host to the worker after it requested input.
 */
export type InputResponseMessage = {
  /**
   * The id of the message.
   */
  id: string;
  /**
   * The "input" type signals to the worker that the host is responding to an
   * input request.
   */
  type: "input";
  /**
   * The input values that the host is providing to the worker.
   * @see [NodeValue]
   */
  data: NodeValue;
};

/**
 * The message that is sent by the worker to the host before it runs a node.
 */
export type BeforehandlerMessage = {
  /**
   * The "beforehandler" type signals to the host that the board is about to
   * run a node.
   */
  type: "beforehandler";
  data: {
    /**
     * The description of the node that is about to be run.
     * @see [NodeDescriptor]
     */
    node: NodeDescriptor;
  };
};

/**
 * The message that is sent by the worker to the host when the board is
 * providing outputs.
 */
export type OutputMessage = {
  /**
   * The "output" type signals to the host that the board is providing outputs.
   */
  type: "output";
  data: {
    /**
     * The description of the node that is providing output.
     * @see [NodeDescriptor]
     */
    node: NodeDescriptor;
    /**
     * The output values that the node is providing.
     * @see [OutputValues]
     */
    outputs: OutputValues;
  };
};

/**
 * The message that is sent by the worker to the host when the board is
 * requesting to proxy the node.
 */
export type ProxyRequestMessage = {
  /**
   * The id of the message.
   */
  id: string;
  /**
   * The "proxy" type signals to the host that the board is requesting to proxy
   * a node.
   */
  type: "proxy";
  data: {
    /**
     * The description of the node that is requesting to be proxied.
     * @see [NodeDescriptor]
     */
    node: NodeDescriptor;
    /**
     * The input values that the board is providing to the node.
     * @see [InputValues]
     */
    inputs: InputValues;
  };
};

/**
 * The message that is sent by the host to the worker after it requested to
 * proxy the node.
 */
export type ProxyResponseMessage = {
  /**
   * The id of the message.
   */
  id: string;
  /**
   * The "proxy" type signals to the worker that the host is responding to a
   * proxy request.
   */
  type: "proxy";
  /**
   * The output values that the host is providing to the board in lieu of
   * the proxied node.
   * @see [OutputValues]
   */
  data: OutputValues;
};

/**
 * The message that is sent by the worker to the host when the board is
 * finished running.
 */
export type EndMessage = {
  /**
   * The "end" type signals to the host that the board is finished running.
   */
  type: "end";
  data: unknown;
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
  data: {
    /**
     * The error message.
     */
    error: string;
  };
};
