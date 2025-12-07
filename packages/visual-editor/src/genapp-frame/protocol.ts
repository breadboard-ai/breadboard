/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type GenAppFrameReadyMessage = {
  type: "genapp-frame-ready";
};

export function isGenAppFrameReadyMessage(
  data: unknown
): data is GenAppFrameReadyMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Partial<GenAppFrameReadyMessage>).type === "genapp-frame-ready"
  );
}

export type GenAppFrameSrcDocMessage = {
  type: "genapp-frame-srcdoc";
  srcdoc: string;
};

export function isGenAppFrameSrcDocMessage(
  data: unknown
): data is GenAppFrameSrcDocMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Partial<GenAppFrameSrcDocMessage>).type === "genapp-frame-srcdoc"
  );
}

export type RequestOpenPopupMessage = {
  type: "request-open-popup";
  url: string;
};

export function isRequestOpenPopupMessage(
  data: unknown
): data is RequestOpenPopupMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Partial<RequestOpenPopupMessage>).type === "request-open-popup"
  );
}
