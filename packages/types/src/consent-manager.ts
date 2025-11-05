/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ConsentType {
  GET_WEBPAGE = 'GET_WEBPAGE',
  OPEN_WEBPAGE = 'OPEN_WEBPAGE',
  USE_MCP = 'MCP',
}

export enum ConsentAction {
  ALLOW = 'allow',
  DENY = 'deny',
  ALWAYS_ALLOW = 'alwaysAllow',
  ALWAYS_DENY = 'alwaysDeny',
}

export type ConsentRequest = ({
  type: ConsentType.USE_MCP,
  scope: {
    url: string;
    scope: string;
  }
} | {
  type: ConsentType.GET_WEBPAGE,
  scope: string;
} | {
  type: ConsentType.OPEN_WEBPAGE,
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
