/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type McpServerDetails = {
  /**
   * Name of the server. Part of the technical details, though when title is
   * not be specified, can be used instead of title
   */
  name: string;
  /**
   * Version of the server.
   */
  version: string;
  /**
   * URL of the server.
   */
  url: string;
};

export type McpServerIdentifier = string;

export type McpServerInstanceIdentifier = string;

export type McpServerDescriptor = {
  /**
   * Title of the MCP server. Assigned by the author or extracted from the
   * MCP server info.
   */
  readonly title: string;
  /**
   * Description of the server.
   */
  readonly description?: string;
  /**
   * Server details.
   */
  readonly details: McpServerDetails;
  /**
   * Whether or not the server is currently registered in this project.
   */
  readonly registered: boolean;
  /**
   * Whether or not the server is removable. We will have some servers that are
   * built-in, so they aren't removable.
   */
  readonly removable: boolean;
};
