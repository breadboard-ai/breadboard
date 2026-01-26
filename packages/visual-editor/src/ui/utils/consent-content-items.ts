/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsentRequest, ConsentType } from "@breadboard-ai/types";
import { HTMLTemplateResult, html } from "lit";

// Helper type to extract the specific ConsentRequest subtype based on the ConsentType
type ConsentRequestOfType<T extends ConsentType> = Extract<
  ConsentRequest,
  { type: T }
>;

// Interface for the render info for a single ConsentType
interface ConsentRenderInfo<T extends ConsentType> {
  name: string;
  description: (request: ConsentRequestOfType<T>) => HTMLTemplateResult;
}

// The type for the main CONSENT_RENDER_INFO object
type ConsentRenderInfoMap = {
  [K in ConsentType]: ConsentRenderInfo<K>;
};

export const CONSENT_RENDER_INFO: ConsentRenderInfoMap = {
  [ConsentType.GET_ANY_WEBPAGE]: {
    name: "This Opal may access external sites",
    description: () => html`
      <p>
        This app was created by another user. Be cautious and only continue with
        apps you trust.
      </p>
      <p>
        Don't share personal or sensitive information, such as passwords or
        payment details.
      </p>
    `,
  },
  [ConsentType.OPEN_WEBPAGE]: {
    name: "Open webpage?",
    description: (request) => html`
      <p>This Opal would like to open a webpage on the following site:</p>
      <p class="center" style="word-break: break-all;">${request.scope}</p>
      <p>Only click allow if you recognize this site and trust the Opal.</p>
    `,
  },
};
