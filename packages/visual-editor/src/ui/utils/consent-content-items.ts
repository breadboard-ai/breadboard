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
  saveButtonLabel?: string;
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
  [ConsentType.ACCESS_DRIVE_FILE_CONTENT]: {
    name: "Opal App - Sensitive Content Awareness",
    description: (request) => {
      let fileId = "";
      let fileName = "Google Drive File";
      let resourceKey = "";
      try {
        const parsed = JSON.parse(request.scope);
        fileId = parsed.fileId || "";
        fileName = parsed.fileName || "Google Drive File";
        resourceKey = parsed.resourceKey || "";
      } catch {
        fileId = request.scope;
        fileName = request.scope;
      }

      const url = new URL("https://drive.google.com/open");
      url.searchParams.set("id", fileId);
      if (resourceKey) {
        url.searchParams.set("resourcekey", resourceKey);
      }

      return html`
        <p>
          This Opal app would like to read and use the content of the following
          Google Drive file to run its steps:
        </p>
        <p
          class="center"
          style="word-break: break-all; margin: var(--bb-grid-size-4) 0;"
        >
          <strong>Google Drive File:</strong>
          <a
            href=${url.href}
            target="_blank"
            style="color: var(--ui-custom-o-100, #1a73e8); text-decoration: none; font-weight: bold; margin-left: 4px;"
          >
            ${fileName}
          </a>
        </p>
        <p>
          Be aware that the contents of this asset will be processed by the Opal
          app. Click allow to permit reading this file's contents and continue.
        </p>
      `;
    },
  },
};
