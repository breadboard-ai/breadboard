/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type TransferHandler, transferHandlers } from "comlink";

console.debug(
  `[shell ${window === window.parent ? "host" : "guest"}] ` +
    `installing comlink transfer handlers`
);

/**
 * Serialize URL instances as strings.
 */
transferHandlers.set("URL", {
  canHandle: (value) => value instanceof URL,
  serialize: (url) => [url.href, []],
  deserialize: (serialized) => new URL(serialized),
} satisfies TransferHandler<URL, string>);

/**
 * Serialize Responses as parameters for the Response constructor, and transfer
 * the body stream memory to avoid a copy.
 */
transferHandlers.set("Response", {
  canHandle: (value) => value instanceof Response,
  serialize: ({ body, headers, status, statusText }) => [
    {
      body,
      init: {
        // Headers instances are not cloneable, but their entries arrays are,
        // and conveniently those arrays are also valid as headers, so we can
        // just convert.
        headers: [...headers],
        status,
        statusText,
      },
    },
    // Transfers the body.
    body ? [body] : [],
  ],
  deserialize: ({ body, init }) => new Response(body, init),
} satisfies TransferHandler<Response, SerializedResponse>);

type SerializedResponse = {
  body: ReadableStream<Uint8Array<ArrayBuffer>> | null;
  init: ResponseInit;
};

/**
 * Custom serialization for the non-cloneable portions of RequestInit.
 */
transferHandlers.set("RequestInit", {
  canHandle: (value): value is RequestInit =>
    // RequestInits are plain objects, so this is a good-enough detection
    // heuristic.
    typeof value === "object" &&
    value !== null &&
    ("headers" in value || "body" in value || "signal" in value) &&
    // Response objects also match the above heuristic, and we handle those
    // separately (technically we don't need this as long as this handler is
    // installed after the Response handler, so this check is just defensive).
    !(value instanceof Response),

  serialize: (init) => {
    init = { ...init };
    const serialized: SerializedRequestInit = { init };
    const transferables: Transferable[] = [];
    if (init.headers instanceof Headers) {
      // Headers instances are not cloneable, but their entries arrays are,
      // and conveniently those arrays are also valid as headers, so we can
      // just convert.
      init.headers = [...init.headers];
    }
    // FormData is not cloneable, but its entries are. Pull the entries array
    // out into a top-level field.
    if (init.body instanceof FormData) {
      serialized.formData = [...init.body];
      delete init.body;
    }
    if (init.signal) {
      // AbortSignals are not transferable, so we bridge them using a
      // MessageChannel.
      const signal = init.signal;
      delete init.signal;
      const channel = new MessageChannel();
      const { port1: sendPort, port2: receivePort } = channel;
      serialized.signal = receivePort;
      transferables.push(receivePort);
      sendPort.start();
      if (signal.aborted) {
        sendPort.postMessage(signal.reason);
        sendPort.close();
      } else {
        signal.addEventListener(
          "abort",
          () => {
            sendPort.postMessage(signal.reason);
            sendPort.close();
          },
          { once: true }
        );
      }
    }
    return [serialized, transferables];
  },

  deserialize: (serialized) => {
    const init = { ...serialized.init };
    if (serialized.formData) {
      init.body = new FormData();
      for (const [name, value] of serialized.formData) {
        init.body.set(name, value);
      }
    }
    if (serialized.signal) {
      const controller = new AbortController();
      init.signal = controller.signal;
      const receivePort = serialized.signal;
      receivePort.addEventListener(
        "message",
        ({ data: reason }) => {
          controller.abort(reason);
          receivePort.close();
        },
        { once: true }
      );
      receivePort.start();
    }
    return init;
  },
} satisfies TransferHandler<RequestInit, SerializedRequestInit>);

type SerializedRequestInit = {
  init: RequestInit;
  formData?: [string, FormDataEntryValue][];
  signal?: MessagePort;
};
