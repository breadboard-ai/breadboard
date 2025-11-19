/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {exec} from 'child_process';
import {promisify} from 'util';
import * as flags from './flags.js';

export async function oauthFetch(url: URL, init: RequestInit): Promise<Response> {
  if (!flags.USE_TESTGAIA) {
    return fetch(url, init);
  }

  // When running on test gaia, the grant/token fetch happens via
  // gaiastaging, which is behind uberproxy and may not be directly
  // reachable via standard node fetch. This provides an approximation
  // to `fetch` via `gosso`.
  const execPromise = promisify(exec);
  try {
    let command = `gosso -url "${url.href}"`;

    if (init.method) {
      command += ` -method="${init.method}"`;
    }

    if (init.headers) {
      const headers = new Headers(init.headers);
      for (const [key, value] of headers.entries()) {
        command += ` -header="${key}: ${value}"`;
      }
    }

    if (init.body) {
      throw new Error('Body not supported for gsso');
    }

    const {stdout, stderr} = await execPromise(command);

    if (stderr) {
      console.warn(`gosso stderr: ${stderr}`);
    }
    return new Response(stdout);
  } catch (error: any) {
    error = String(error);
    if (error.includes('command not found')) {
      error = 'When running in test gaia, gosso is required. Install using `sudo mule install gosso`'
    }
    return new Response(JSON.stringify({error}), {status: 500});
  }
}