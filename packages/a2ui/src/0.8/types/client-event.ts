/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A message from the client describing its capabilities, such as the component
 * catalog it supports. Exactly ONE of the properties in this object must be
 * set.
 */

export type ClientCapabilitiesUri = string;
export type ClientCapabilitiesDynamic = {
  components: { [key: string]: unknown };
  styles: { [key: string]: unknown };
};

export type ClientCapabilities =
  | { catalogUri: ClientCapabilitiesUri }
  | { dynamicCatalog: ClientCapabilitiesDynamic };

/**
 * A message sent from the client to the server. Exactly ONE of the properties
 * in this object must be set.
 */
export interface A2UIClientEventMessage {
  userAction?: UserAction;
  clientUiCapabilities?: ClientCapabilities;
  error?: ClientError;
  /** Demo content */
  request?: unknown;
}

/**
 * Represents a user-initiated action, sent from the client to the server.
 */
export interface UserAction {
  /**
   * The name of the action, taken from the component's `action.action`
   * property.
   */
  actionName: string;
  /**
   * The `id` of the component that triggered the event.
   */
  sourceComponentId: string;
  /**
   * An ISO 8601 timestamp of when the event occurred.
   */
  timestamp: string;
  /**
   * A JSON object containing the key-value pairs from the component's
   * `action.context`, after resolving all data bindings.
   */
  context?: {
    [k: string]: unknown;
  };
}

/**
 * A message from the client indicating an error occurred, for example,
 * during UI rendering.
 */
export interface ClientError {
  [k: string]: unknown;
}
