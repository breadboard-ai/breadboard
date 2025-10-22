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
 * Custom serializtion for the non-cloneable portions of RequestInit.
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
      // Maybe we could do something fancy with abort signals where we listen to
      // them on this side, then broadcast over another comlink method to a
      // newly created signal on the other side if they abort... but it doesn't
      // seem worth it right now, because aborts are mostly a performance thing,
      // and we don't make much use of them anyway.
      delete init.signal;
    }
    return [serialized, []];
  },

  deserialize: (serialized) => {
    const init = { ...serialized.init };
    if (serialized.formData) {
      init.body = new FormData();
      for (const [name, value] of serialized.formData) {
        init.body.set(name, value);
      }
    }
    return init;
  },
} satisfies TransferHandler<RequestInit, SerializedRequestInit>);

type SerializedRequestInit = {
  init: RequestInit;
  formData?: [string, FormDataEntryValue][];
};
