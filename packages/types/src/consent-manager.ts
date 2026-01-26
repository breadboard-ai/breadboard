/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ConsentType {
  GET_ANY_WEBPAGE = "GET_ANY_WEBPAGE",
  OPEN_WEBPAGE = "OPEN_WEBPAGE",
  // TODO: Add MCP, etc.
}

export enum ConsentAction {
  ALLOW = "allow",
  DENY = "deny",
  ALWAYS_ALLOW = "alwaysAllow",
  ALWAYS_DENY = "alwaysDeny",
}

export enum ConsentUIType {
  MODAL = "MODAL",
  IN_APP = "IN_APP",
}

export type ConsentRequest = (
  | {
      type: ConsentType.GET_ANY_WEBPAGE;
      scope: /* eslint-disable-next-line @typescript-eslint/no-empty-object-type */
      {};
    }
  | {
      type: ConsentType.OPEN_WEBPAGE;
      scope: string;
    }
) & { graphUrl: string };

