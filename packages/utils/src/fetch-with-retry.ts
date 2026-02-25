/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { fetchWithRetry };

const RETRY_MS = 200;
const MAX_ATTEMPTS = 3;

/** Retries fetch() calls until status is not an internal server error. */
async function fetchWithRetry(
  realFetch: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
): Promise<Response> {
  let attemptsLeft = MAX_ATTEMPTS;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let response: Response;
    let isRetryable = false;
    try {
      response = await realFetch(input, init);
      if (response.status >= 500 && response.status <= 599) {
        isRetryable = true;
        console.warn(
          `Error in fetch(${input}). Attempts left: ${attemptsLeft - 1}/${MAX_ATTEMPTS}. Response:`,
          response
        );
      }
    } catch (e) {
      isRetryable = true;
      console.warn(
        `Exception in fetch(${input}). Attempts left: ${attemptsLeft - 1}/${MAX_ATTEMPTS}`,
        e
      );
      // TODO: Faking a 403 here is misleading. We should throw instead so
      // that we preserve the normal fetch behavior. We'll need to look
      // for places we might depend on this behavior first, though.
      response = new Response(null, { status: 403 });
    }
    attemptsLeft--;
    if (!isRetryable || attemptsLeft <= 0) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}
