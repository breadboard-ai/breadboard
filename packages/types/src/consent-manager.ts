/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ConsentType {
  MCP = 'mcp',
  FETCH = 'fetch',
  POPUP = 'popup',
}

export enum ConsentAction {
  ALLOW = 'allow',
  DENY = 'deny',
  ALWAYS_ALLOW = 'alwaysAllow',
  ALWAYS_DENY = 'alwaysDeny',
}

export type ConsentRequest = ({
  type: ConsentType.MCP,
  scope: {
    url: string;
    scope: string;
  }
} | {
  type: ConsentType.FETCH,
  scope: string;
} | {
  type: ConsentType.POPUP,
  scope: string;
}) & { graphId: string };

export type ConsentRequestWithCallback = {
  request: ConsentRequest;
  consentCallback: (action: ConsentAction) => void;
}

export interface ConsentManager {
  setConsent(request: ConsentRequest, allow: boolean): Promise<void>;
  queryConsent(request: ConsentRequest, askIfMissing: boolean): Promise<boolean | undefined>;
  revokeConsent(request: ConsentRequest): Promise<void>;
  getAllConsentsByType(type: ConsentRequest['type']): Promise<ConsentRequest[]>;
  clearAllConsents(): Promise<void>;
}
