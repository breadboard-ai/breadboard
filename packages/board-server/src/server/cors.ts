/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import expressCors from "cors";

const options = {
  credentials: true,
  // Different browsers allow different max values for max age. The highest
  // seems to be 24 hours.
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
  maxAge: 24 * 60 * 60,
};

export const corsAll = expressCors(options);

export const cors = (allowedOrigins: string[]) => {
  return expressCors({ ...options, origin: allowedOrigins });
};
