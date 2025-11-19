/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {exec} from 'child_process';
import {promisify} from 'util';
import * as flags from './flags.js';

/**
 * By default, fetches the URL using the default fetch.
 *
 * If OAUTH_FETCH_COMMAND is set, the server will shell out to the provided
 * cURL-like command to fetch the URL.
 */
export async function oauthFetch(url: URL, init: RequestInit): Promise<Response> {
  if (!flags.OAUTH_FETCH_COMMAND) {
    return fetch(url, init);
  }
  const execPromise = promisify(exec);
  try {
    let command = `${flags.OAUTH_FETCH_COMMAND} -url "${url.href}"`;
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
      throw new Error(
        "Body not currently supported when using OAUTH_FETCH_COMMAND"
      );
    }
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      console.warn(`${flags.OAUTH_FETCH_COMMAND} stderr: ${stderr}`);
    }
    return new Response(stdout);
  } catch (error: any) {
    error = String(error);
    if (error.includes("command not found")) {
      error = `Command ${flags.OAUTH_FETCH_COMMAND} passed as OAUTH_FETCH_COMMAND not found. Do you need to install it?`;
    }
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
}