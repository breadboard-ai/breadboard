/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { fetchWithRetry };

/** Delay between GDrive API retries. */
const RETRY_MS = 200;

/** Retries fetch() calls until status is not an internal server error. */
async function fetchWithRetry(
  fetchToUse: typeof fetch,
  input: string | Request | URL,
  init?: RequestInit,
  numAttempts: 1 | 2 | 3 | 4 | 5 = 3
): Promise<Response> {
  function shouldRetry(response: Response): boolean {
    return 500 <= response.status && response.status <= 599;
  }

  async function recursiveHelper(numAttemptsLeft: number): Promise<Response> {
    numAttemptsLeft -= 1;
    let response: Response | null = null;
    try {
      response = await fetchToUse(input, init);
      if (shouldRetry(response)) {
        console.warn(
          `Error in fetch(${input}). Attempts left: ${numAttemptsLeft}/${numAttempts}. Response:`,
          response
        );
      } else {
        return response;
      }
    } catch (e) {
      console.warn(
        `Exception in fetch(${input}). Attempts left: ${numAttemptsLeft}/${numAttempts}`,
        e
      );
      // return "403 Forbidden" response, as this is likely a CORS error
      response = new Response(null, {
        status: 403,
      });
    }

    if (numAttemptsLeft <= 0) {
      return response;
    }

    return await new Promise((resolve) => {
      setTimeout(async () => {
        resolve(await recursiveHelper(numAttemptsLeft));
      }, RETRY_MS);
    });
  }

  return recursiveHelper(numAttempts);
}
