/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppSandboxReadyMessage = {
  type: "app-sandbox-ready";
};

export function isAppSandboxReadyMessage(
  data: unknown
): data is AppSandboxReadyMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Partial<AppSandboxReadyMessage>).type === "app-sandbox-ready"
  );
}

export type AppSandboxSrcDocMessage = {
  type: "app-sandbox-srcdoc";
  srcdoc: string;
};

export function isAppSandboxSrcDocMessage(
  data: unknown
): data is AppSandboxSrcDocMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Partial<AppSandboxSrcDocMessage>).type === "app-sandbox-srcdoc"
  );
}

export type AppSandboxRequestOpenPopupMessage = {
  type: "app-sandbox-request-open-popup";
  url: string;
};

export function isAppSandboxRequestOpenPopupMessage(
  data: unknown
): data is AppSandboxRequestOpenPopupMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Partial<AppSandboxRequestOpenPopupMessage>).type ===
      "app-sandbox-request-open-popup"
  );
}
